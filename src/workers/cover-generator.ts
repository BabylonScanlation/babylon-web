import type { Env } from '../env';

// Import Squoosh lib modules
import { decode as decodeWebP } from '@squoosh/lib/webp/decode';
import { decode as decodeJpeg } from '@squoosh/lib/jpeg/decode';
import { decode as decodePng } from '@squoosh/lib/png/decode';
import { resize } from '@squoosh/lib/resize';
import { encode as encodeJpeg } from '@squoosh/lib/jpeg/encode';
import { encode as encodeWebP } from '@squoosh/lib/webp/encode';

export interface CoverGenerationMessage {
  chapter_id: number;
  original_image_url: string;
  title: string;
}

export default {
  async queue(batch: MessageBatch<CoverGenerationMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { chapter_id, original_image_url, title } = message.body;
      console.log(`Processing chapter ${chapter_id}: ${title} from ${original_image_url}`);

      try {
        // 1. Fetch original image from original_image_url (Telegram)
        const originalImageResponse = await fetch(original_image_url);
        if (!originalImageResponse.ok) {
          throw new Error(`Failed to fetch original image from Telegram: ${originalImageResponse.statusText}`);
        }
        const originalImageBuffer = await originalImageResponse.arrayBuffer();
        const imageContentType = originalImageResponse.headers.get('Content-Type') || 'image/jpeg';

        // 2. Upload original image to R2 (R2_ASSETS)
        const r2KeyOriginal = `original-images/${chapter_id}.${imageContentType.split('/')[1] || 'jpg'}`;
        await env.R2_ASSETS.put(r2KeyOriginal, originalImageBuffer, {
          httpMetadata: { contentType: imageContentType },
        });
        const originalImageR2Url = `${env.R2_PUBLIC_URL_ASSETS}/${r2KeyOriginal}`;
        console.log(`Original image uploaded to R2: ${originalImageR2Url}`);

        // --- Image Processing within Worker using @squoosh/lib ---
        let decodedImage: ImageData;

        // Decode image based on content type
        if (imageContentType.includes('image/webp')) {
          decodedImage = await decodeWebP(new Uint8Array(originalImageBuffer));
        } else if (imageContentType.includes('image/jpeg')) {
          decodedImage = await decodeJpeg(new Uint8Array(originalImageBuffer));
        } else if (imageContentType.includes('image/png')) {
          decodedImage = await decodePng(new Uint8Array(originalImageBuffer));
        } else {
          throw new Error(`Unsupported image format: ${imageContentType}`);
        }

        const originalWidth = decodedImage.width;
        const originalHeight = decodedImage.height;
        const targetCoverSize = 400; // Target size for the final cover

        // Determine the size of the square crop
        const cropDimension = Math.min(originalWidth, originalHeight);

        // Calculate random crop coordinates
        // cropX can range from 0 to (originalWidth - cropDimension)
        const maxCropX = originalWidth - cropDimension;
        const cropX = maxCropX > 0 ? Math.floor(Math.random() * (maxCropX + 1)) : 0;

        // cropY can range from 0 to (originalHeight - cropDimension)
        const maxCropY = originalHeight - cropDimension;
        const cropY = maxCropY > 0 ? Math.floor(Math.random() * (maxCropY + 1)) : 0;

        // Manually extract the cropped region into a new ImageData object
        const croppedImageData = new ImageData(cropDimension, cropDimension);
        for (let y = 0; y < cropDimension; y++) {
          for (let x = 0; x < cropDimension; x++) {
            const originalIndex = ((cropY + y) * originalWidth + (cropX + x)) * 4;
            const croppedIndex = (y * cropDimension + x) * 4;
            croppedImageData.data[croppedIndex] = decodedImage.data[originalIndex];       // R
            croppedImageData.data[croppedIndex + 1] = decodedImage.data[originalIndex + 1]; // G
            croppedImageData.data[croppedIndex + 2] = decodedImage.data[originalIndex + 2]; // B
            croppedImageData.data[croppedIndex + 3] = decodedImage.data[originalIndex + 3]; // A
          }
        }

        // Resize the randomly cropped image to the target cover size
        const resizedAndCroppedImage = await resize(croppedImageData, {
          width: targetCoverSize,
          height: targetCoverSize,
          fitMethod: 'stretch', // Stretch the pre-cropped square to the target size
        });

        // Encode the processed image to JPEG for efficiency
        const encodedImageBuffer = await encodeJpeg(resizedAndCroppedImage, { quality: 80 });

        // 3. Upload final processed cover to R2 (R2_ASSETS)
        const finalR2Key = `covers/${chapter_id}.jpeg`; // Using JPEG for output
        await env.R2_ASSETS.put(finalR2Key, encodedImageBuffer.binary, {
          httpMetadata: { contentType: 'image/jpeg' },
        });
        const finalCoverUrl = `${env.R2_PUBLIC_URL_ASSETS}/${finalR2Key}`;
        console.log(`Final processed cover uploaded to R2: ${finalCoverUrl}`);

        // 4. Update D1 Chapters table with url_portada
        await env.DB
          .prepare('UPDATE Chapters SET url_portada = ? WHERE id = ?')
          .bind(finalCoverUrl, chapter_id)
          .run();

        console.log(`Successfully processed chapter ${chapter_id}. D1 updated with cover URL: ${finalCoverUrl}.`);
      } catch (error) {
        console.error(`Error processing chapter ${chapter_id}:`, error);
        // Retry the message if it hasn't been attempted too many times
        if (message.attempts < 3) { // Retry up to 2 more times after the initial attempt
          console.log(`Retrying message for chapter ${chapter_id}. Attempt ${message.attempts + 1}.`);
          message.retry();
        } else {
          console.error(`Max retries reached for chapter ${chapter_id}. Message will not be retried.`);
        }
      }
    }
  },
};