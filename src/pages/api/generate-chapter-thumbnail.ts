// src/pages/api/generate-chapter-thumbnail.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';

interface ChapterManifest {
  imageUrls: string[];
}

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  R2_BUCKET_COLD: R2Bucket;
  R2_ASSETS: R2Bucket;
  R2_PUBLIC_URL_ASSETS: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDB(env);

  try {
    const { chapterId, telegramFileId, seriesSlug, chapterNumber } = await request.json();

    if (!chapterId || !telegramFileId || !seriesSlug || !chapterNumber) {
      return new Response(
        JSON.stringify({ error: 'chapterId, telegramFileId, seriesSlug, and chapterNumber are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[Thumbnail Gen] Starting for Chapter ID: ${chapterId}, Series: ${seriesSlug}, Chapter: ${chapterNumber}`
    );

    let imageBlob: Blob | null = null;
    let imageExtension: string | null = null;

    // 1. Try to get image from R2_CACHE first
    const manifestKey = `${seriesSlug}/${chapterNumber}/manifest.json`;
    const manifestObject = await env.R2_BUCKET_COLD.get(manifestKey);

    if (manifestObject) {
      console.log(`[Thumbnail Gen] Manifest found in R2_CACHE for ${seriesSlug}/${chapterNumber}. Using cached images.`);
      const manifestContent = (await manifestObject.json()) as ChapterManifest;
      const imageUrls = manifestContent.imageUrls; // These are R2_CACHE keys

      if (imageUrls && imageUrls.length > 0) {
        // Get the first image from R2_CACHE
        const firstImageR2Key = imageUrls[0];
        if (typeof firstImageR2Key === 'string') { // Explicitly check type
          const cachedImage = await env.R2_BUCKET_COLD.get(firstImageR2Key);

          if (cachedImage) {
            imageBlob = (await cachedImage.blob() as unknown) as Blob; // Explicit cast to global Blob
            const ext = firstImageR2Key.split('.').pop();
            if (typeof ext === 'string') { // Explicitly check type
              imageExtension = ext;
            }
          } else {
            console.warn(`[Thumbnail Gen] First image not found in R2_CACHE for key: ${firstImageR2Key}. Falling back to Telegram.`);
          }
        }
      }
    }

    // 2. If not found in R2_CACHE, download from Telegram
    if (!imageBlob) {
      console.log(`[Thumbnail Gen] Image not found in R2_CACHE. Downloading from Telegram for ${seriesSlug}/${chapterNumber}.`);
      const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${telegramFileId}`;
      const fileInfoResponse = await fetch(telegramApiUrl);
      const fileInfo: any = await fileInfoResponse.json();

      if (
        !fileInfoResponse.ok ||
        !fileInfo.result ||
        !fileInfo.result.file_path
      ) {
        throw new Error(
          `Failed to get file info from Telegram: ${fileInfo.description || 'Unknown error'}`
        );
      }

      const filePath = fileInfo.result.file_path;
      const fileDownloadUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;

      const zipResponse = await fetch(fileDownloadUrl);
      if (!zipResponse.ok) {
        throw new Error(
          `Failed to download ZIP from Telegram: ${zipResponse.statusText}`
        );
      }

      const zipBlob = await zipResponse.blob();

      const zipReader = new ZipReader(new BlobReader(zipBlob));
      const entries = await zipReader.getEntries();

      let firstImageEntry: any = null;
      for (const entry of entries) {
        if (!entry.directory && entry.filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
          firstImageEntry = entry;
          break;
        }
      }

      if (!firstImageEntry) {
        throw new Error('No image found in the chapter ZIP file.');
      }

      imageBlob = (await firstImageEntry.getData(new BlobWriter()) as unknown) as Blob; // Explicit cast to global Blob
      const ext = firstImageEntry.filename.split('.').pop();
      if (typeof ext === 'string') {
        imageExtension = ext;
      }
    }

    if (!imageBlob || !imageExtension) {
      throw new Error('Could not obtain image for thumbnail generation.');
    }

    // 3. Upload the original image to a temporary R2 location for resizing
    const tempR2Key = `temp-chapter-originals/${chapterId}.${imageExtension}`;
    await env.R2_BUCKET_COLD.put(tempR2Key, imageBlob as any, {
      httpMetadata: { contentType: imageBlob.type },
    });
    const tempImageUrl = `${env.R2_PUBLIC_URL_ASSETS}/${tempR2Key}`;

    // 4. Call Cloudflare Image Resizing API to get the resized image
    const resizeApiUrl = `${tempImageUrl}?width=200&height=300&fit=cover`;
    const resizedImageResponse = await fetch(resizeApiUrl);

    if (!resizedImageResponse.ok) {
      throw new Error(`Failed to resize image: ${resizedImageResponse.statusText}`);
    }

    const resizedImageBlob = await resizedImageResponse.blob();

    // 5. Upload the resized image to R2_ASSETS
    const finalR2Key = `series-covers/${seriesSlug}/${chapterId}.jpg`; // Always save as JPG for consistency
    await env.R2_ASSETS.put(finalR2Key, resizedImageBlob as any, {
      httpMetadata: { contentType: 'image/jpeg' }, // Assuming JPG output from resizing
    });

    // 6. Update the D1 database with the direct URL to the resized image
    const finalThumbnailUrl = `${env.R2_PUBLIC_URL_ASSETS}/${finalR2Key}`;

    await db
      .prepare('UPDATE Chapters SET url_portada = ? WHERE id = ?')
      .bind(finalThumbnailUrl, chapterId)
      .run();

    // 7. Clean up temporary original image from R2_BUCKET_COLD
    await env.R2_BUCKET_COLD.delete(tempR2Key);

    console.log(
      `[Thumbnail Gen] Completed for Chapter ID: ${chapterId}. Cover image updated.`
    );

    return new Response(
      JSON.stringify({
        message: 'Cover image generated and updated successfully',
        thumbnailUrl: finalThumbnailUrl,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Thumbnail Gen] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
