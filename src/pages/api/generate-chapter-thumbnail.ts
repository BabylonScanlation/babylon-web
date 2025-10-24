// src/pages/api/generate-chapter-thumbnail.ts
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { D1Database, R2Bucket } from '@cloudflare/workers-types'; // Assuming R2Bucket type is available
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';

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

    console.log(
      `[Thumbnail Gen] Starting for Chapter ID: ${chapterId}, Telegram File ID: ${telegramFileId}`
    );

    // Descargar el archivo ZIP de Telegram
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

    // Obtener el ArrayBuffer del ZIP
    const zipBlob = await zipResponse.blob();

    // Descomprimir el archivo ZIP
    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();

    const imageUrls: string[] = [];

    for (const entry of entries) {
      if (!entry.directory && entry.filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const imageBlob = await entry.getData(new BlobWriter());
        const r2Key = `chapter-thumbnails/${chapterId}/${entry.filename}`;

        // Subir la imagen a R2
        await env.R2_BUCKET_COLD.put(r2Key, imageBlob as any, {
          // contentType: imageBlob.type, // Esto podría ser útil si R2 no lo detecta automáticamente
        });

        const imageUrl = `https://your-r2-public-url/${r2Key}`; // Reemplaza con tu URL pública de R2
        imageUrls.push(imageUrl);
      }
    }

    await zipReader.close();

    // Actualizar la base de datos D1 con las URLs de las miniaturas
    // Aquí asumo que tienes una tabla para almacenar las miniaturas de los capítulos
    // y que chapterId es la clave para relacionarlas.
    await db
      .prepare(
        'INSERT INTO chapter_thumbnails (chapter_id, image_urls) VALUES (?, ?) ON CONFLICT(chapter_id) DO UPDATE SET image_urls = EXCLUDED.image_urls'
      )
      .bind(chapterId, JSON.stringify(imageUrls))
      .run();

    console.log(
      `[Thumbnail Gen] Completed for Chapter ID: ${chapterId}. Uploaded ${imageUrls.length} images.`
    );

    return new Response(
      JSON.stringify({
        message: 'Thumbnails generated and uploaded successfully',
        imageUrls,
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
};
