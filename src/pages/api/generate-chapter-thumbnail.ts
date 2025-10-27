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
  R2_CACHE: R2Bucket;      // Asegurarse de que esté definida
  R2_ASSETS: R2Bucket;
  R2_PUBLIC_URL_ASSETS: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as Env;
  const db = getDB(env);
  let requestBody: any = {}; // Variable para guardar el body

  try {
    // Intenta leer y loguear el cuerpo ANTES de cualquier otra cosa
    try {
        requestBody = await request.json();
        console.log('[Thumbnail Gen API] Body recibido:', JSON.stringify(requestBody)); // Loguea el cuerpo parseado
    } catch (parseError) {
        console.error('[Thumbnail Gen API] Error al parsear JSON del body:', parseError);
        // Intenta loguear el texto raw si falla el parseo
        try {
            const rawText = await request.text(); // Necesitas clonar si usas request.json() después
            console.error('[Thumbnail Gen API] Cuerpo raw recibido:', rawText);
        } catch (rawReadError) {
             console.error('[Thumbnail Gen API] No se pudo leer el cuerpo raw.');
        }
        return new Response( JSON.stringify({ error: 'Cuerpo de la petición inválido (no es JSON)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const chapterId = requestBody?.chapterId;
    const telegramFileId = requestBody?.telegramFileId;
    const seriesSlug = requestBody?.seriesSlug;
    const chapterNumber = requestBody?.chapterNumber;

    // --- VALIDACIÓN MEJORADA EN BACKEND ---
    if (
      chapterId === undefined || chapterId === null ||
      !telegramFileId || // Check truthiness (string no puede ser 0)
      !seriesSlug ||    // Check truthiness (string no puede ser 0)
      chapterNumber === undefined || chapterNumber === null // Permitir 0, pero no null/undefined
    ) {
      // Loguea qué campo específico falló (si es posible)
      console.error('[Thumbnail Gen API] Parámetros faltantes o inválidos. Valores:', { chapterId, telegramFileId, seriesSlug, chapterNumber });
      return new Response(
        JSON.stringify({ error: 'chapterId, telegramFileId, seriesSlug, and chapterNumber son requeridos y deben tener valores válidos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // --- FIN VALIDACIÓN MEJORADA ---

    // Convertir a números después de validar que existen
    const chapterIdNum = Number(chapterId);
    const chapterNumberNum = Number(chapterNumber);

    // Verificar si la conversión falló (importante para números)
     if (isNaN(chapterIdNum) || isNaN(chapterNumberNum)) {
       console.error('[Thumbnail Gen API] Conversión numérica inválida. Recibido:', requestBody);
       return new Response(
         JSON.stringify({ error: 'chapterId y chapterNumber deben ser números válidos.' }),
         { status: 400, headers: { 'Content-Type': 'application/json' } }
       );
     }


    console.log(
      `[Thumbnail Gen] Starting for Chapter ID: ${chapterIdNum}, Series: ${seriesSlug}, Chapter: ${chapterNumberNum}`
    );

    let imageBlob: Blob | null = null;
    let imageExtension: string | null = null;

    // 1. Try to get image from R2_CACHE first
    const manifestKey = `${seriesSlug}/${chapterNumberNum}/manifest.json`;
    const manifestObject = await env.R2_CACHE.get(manifestKey);

    if (manifestObject) {
      console.log(`[Thumbnail Gen] Manifest found in R2_CACHE for ${seriesSlug}/${chapterNumber}. Using cached images.`);
      const manifestContent = (await manifestObject.json()) as ChapterManifest;
      const imageUrls = manifestContent.imageUrls; // These are R2_CACHE keys

      if (imageUrls && imageUrls.length > 0) {
        // Get the first image from R2_CACHE
        const firstImageR2Key = imageUrls[0];
        if (typeof firstImageR2Key === 'string') { // Explicitly check type
          const cachedImage = await env.R2_CACHE.get(firstImageR2Key);

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
    await env.R2_CACHE.put(tempR2Key, imageBlob as any, {
      httpMetadata: { contentType: imageBlob.type },
    });
    const tempImageUrl = `${env.R2_PUBLIC_URL_ASSETS}/${tempR2Key}`;

    // 4. Call Cloudflare Image Resizing API to get the resized image
    const targetWidth = 200;
    const targetHeight = 300;
    const resizeApiUrl = `${tempImageUrl}?width=${targetWidth}&height=${targetHeight}&fit=crop&gravity=center`; // Cambiado fit=cover por fit=crop&gravity=center

    console.log(`[Thumbnail Gen] Requesting resized image using CROP from: ${resizeApiUrl}`); // Actualiza el log si quieres

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
      .bind(finalThumbnailUrl, chapterIdNum)
      .run();

    // 7. Clean up temporary original image from R2_BUCKET_COLD
    await env.R2_CACHE.delete(tempR2Key);

    console.log(
      `[Thumbnail Gen] Completed for Chapter ID: ${chapterIdNum}. Cover image updated.`
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
