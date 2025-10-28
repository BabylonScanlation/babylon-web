// src/lib/chapterProcessing.ts
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

// La interfaz no cambia
interface RuntimeEnv {
  DB: D1Database;
  R2_CACHE: R2Bucket;
  R2_ASSETS: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  R2_PUBLIC_URL_CACHE: string;
  R2_PUBLIC_URL_ASSETS: string;
  ADMIN_PASSWORD: string;
}

interface TelegramGetFileResponse {
  ok: boolean;
  result?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    file_path?: string;
  };
  description?: string; // For error cases
}

export async function processAndCacheChapter(
  env: RuntimeEnv,
  fileId: string,
  seriesSlug: string,
  chapterNumber: number
) {
  try {
    console.log(
      `[PROCESO-ON-DEMAND] Iniciando para ${seriesSlug}/${chapterNumber}`
    );

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const fileInfo = (await fileInfoResponse.json()) as TelegramGetFileResponse;
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      console.error(
        `[PROCESO-ON-DEMAND] Error en API de Telegram: ${fileInfo.description || 'No file path'}`
      );
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const zipResponse = await fetch(fileUrl);
    if (!zipResponse.ok) {
      console.error(
        `[PROCESO-ON-DEMAND] Error descargando ZIP de Telegram (status: ${zipResponse.status})`
      );
      return;
    }
    const zipBlob = await zipResponse.blob();

    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();
    const imageEntries = entries.filter(
      (entry) => !entry.directory && /\.(jpe?g|png|webp)$/i.test(entry.filename)
    );

    if (imageEntries.length === 0) {
      console.error(
        '[PROCESO-ON-DEMAND] No se encontraron imágenes en el ZIP.'
      );
      return;
    }

    const pageUploadPromises = imageEntries.map(async (entry) => {
      const pageNumberMatch = entry.filename.match(/(\d+)/);
      if (!pageNumberMatch) return null;
      const pageNumber = parseInt(pageNumberMatch[0], 10);
      if (typeof entry.getData !== 'function') return null;

      const imageBlob = await entry.getData(new BlobWriter());
      const imageBuffer = await imageBlob.arrayBuffer();
      const r2Key = `${seriesSlug}/${chapterNumber}/${entry.filename}`;

      await env.R2_CACHE.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType: imageBlob.type,
          cacheControl: 'public, max-age=86400',
        },
      });
      return { pageNumber, r2Key };
    });

    const uploadedPagesData = (await Promise.all(pageUploadPromises)).filter(
      (p) => p !== null
    );

    if (uploadedPagesData.length > 0) {
      // === ¡AQUÍ ESTÁ LA CORRECCIÓN! ===
      // Cambiamos 'slug' por 'seriesSlug'
      const manifestKey = `${seriesSlug}/${chapterNumber}/manifest.json`;
      const imageUrls = uploadedPagesData
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map((page) => `${env.R2_PUBLIC_URL_CACHE}/${page.r2Key}`);

      const manifestContent = { imageUrls };

      await env.R2_CACHE.put(manifestKey, JSON.stringify(manifestContent), {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=86400',
        },
      });
      console.log(
        `[PROCESO-ON-DEMAND] ¡ÉXITO! Manifest creado en CACHÉ para ${manifestKey}`
      );
    }
  } catch (error) {
    console.error(
      `[PROCESO-ON-DEMAND] Error crítico procesando el ZIP para ${seriesSlug}/${chapterNumber}:`,
      error
    );
  }
}
