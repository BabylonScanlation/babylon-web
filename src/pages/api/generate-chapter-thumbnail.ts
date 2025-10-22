// src/pages/api/generate-chapter-thumbnail.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { R2Bucket } from '@cloudflare/workers-types'; // Assuming R2Bucket type is available

interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  R2_BUCKET_COLD: R2Bucket; // Assuming this is the binding for your cold storage R2 bucket
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDB(env);

  try {
    const { chapterId, telegramFileId } = await request.json();

    if (!chapterId || !telegramFileId) {
      return new Response(
        JSON.stringify({ error: 'chapterId and telegramFileId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Thumbnail Gen] Starting for Chapter ID: ${chapterId}, Telegram File ID: ${telegramFileId}`);

    // --- TEMPORALMENTE DESHABILITADO: Extracción de ZIP ---
    // const { ZipReader, BlobReader, BlobWriter } = await import('@zip.js/zip.js');
    // const zipReader = new ZipReader(new BlobReader(new Blob([zipBuffer])));
    // const entries = await zipReader.getEntries();
    //
    // const imageEntries: { name: string; getData: () => Promise<Blob> }[] = [];
    // for (const entry of entries) {
    //   if (!entry.directory && entry.filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
    //     imageEntries.push({
    //       name: entry.filename,
    //       getData: () => entry.getData(new BlobWriter()),
    //     });
    //   }
    // }
    // await zipReader.close();
    //
    // if (imageEntries.length === 0) {
    //   throw new Error('No image files found in the .zip archive.');
    // }
    //
    // // --- Part 4: Image Processing (Resizing/Cropping) ---
    // // 1. Select a random image
    // const randomIndex = Math.floor(Math.random() * imageEntries.length);
    // const selectedImageEntry = imageEntries[randomIndex];
    // const selectedImageBlob = await selectedImageEntry.getData();
    //
    // // 2. Upload selected image to a temporary R2 location
    // const tempImageKey = `temp/${chapterId}/${selectedImageEntry.name}`;
    // await env.R2_BUCKET_COLD.put(tempImageKey, selectedImageBlob);
    //
    // // Assuming R2_PUBLIC_URL_ASSETS is configured for Cloudflare Image Resizing
    // // and points to the domain where R2_BUCKET_COLD is served.
    // // Example: https://imagedelivery.net/<ACCOUNT_HASH>/<R2_BUCKET_COLD_DOMAIN>/<KEY>
    // // For simplicity, let's assume a direct URL for resizing via Workers.
    // // The actual Cloudflare Image Resizing URL structure might vary based on setup.
    // // For now, we'll construct a URL that a Worker could use to resize.
    // // A more robust solution would involve a dedicated Image Resizing service setup.
    //
    // // For demonstration, let's assume a direct R2 public URL and Cloudflare Image Resizing via URL parameters.
    // // This requires the R2 bucket to be configured for public access and Image Resizing enabled.
    // const r2BaseUrl = `https://${env.R2_BUCKET_COLD_DOMAIN}`; // Assuming you have a custom domain for R2_BUCKET_COLD
    // const originalImageUrl = `${r2BaseUrl}/${tempImageKey}`;
    //
    // // Cloudflare Image Resizing parameters (example: 200x200, fit=cover)
    // const thumbnailWidth = 200;
    // const thumbnailHeight = 300; // Cambiado de 200 a 300
    // const imageResizingUrl = `${originalImageUrl}?width=${thumbnailWidth}&height=${thumbnailHeight}&fit=cover&format=webp`;
    //
    // // 3. Fetch the resized image
    // const resizedImageResponse = await fetch(imageResizingUrl);
    // if (!resizedImageResponse.ok) {
    //   throw new Error(`Failed to resize image using Cloudflare Image Resizing: ${resizedImageResponse.statusText}`);
    // }
    // const thumbnailBlob = await resizedImageResponse.blob();
    //
    // console.log(`[Thumbnail Gen] Image processed for Chapter ID: ${chapterId}`);
    //
    // // --- Part 5: Upload to R2 (to be implemented next) ---
    // const thumbnailKey = `chapter-thumbnails/${chapterId}.webp`;
    // await env.R2_BUCKET_COLD.put(thumbnailKey, thumbnailBlob, { 
    //   httpMetadata: { contentType: 'image/webp' }
    // });
    //
    // const thumbnailUrl = `${r2BaseUrl}/${thumbnailKey}`;
    //
    // // Update D1 with the actual thumbnail URL
    // await db
    //   .prepare('UPDATE Chapters SET thumbnail_url = ? WHERE id = ?')
    //   .bind(thumbnailUrl, chapterId)
    //   .run();
    //
    // console.log(`[Thumbnail Gen] Thumbnail URL updated for Chapter ID: ${chapterId}`);
    //
    // return new Response(
    //   JSON.stringify({ success: true, thumbnailUrl }),
    //   { status: 200, headers: { 'Content-Type': 'application/json' } }
    // );

    // TEMPORAL: Devolver un error para indicar que la funcionalidad ZIP está deshabilitada
    return new Response(
      JSON.stringify({ error: 'ZIP extraction is temporarily disabled for debugging.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    // --- FIN TEMPORALMENTE DESHABILITADO ---
