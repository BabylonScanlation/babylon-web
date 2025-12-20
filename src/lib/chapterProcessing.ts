// src/lib/chapterProcessing.ts
import { ZipReader, BlobReader, BlobWriter, type Entry } from '@zip.js/zip.js';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { logError } from './logError';

// Define a type that represents a file entry with the getData method
type FileEntryWithGetData = Entry & {
  getData(_writer: BlobWriter): Promise<Blob>;
}

// User-defined type guard to check if an Entry is a file and has getData
function isFileEntryWithGetData(entry: Entry): entry is FileEntryWithGetData {
  return (
    !entry.directory &&
    typeof (entry as FileEntryWithGetData).getData === 'function'
  );
}

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
  const successfullyUploadedKeys: string[] = [];
  try {
    console.log(
      `[PROCESO-ON-DEMAND] Iniciando para ${seriesSlug}/${chapterNumber}`
    );

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const fileInfo = (await fileInfoResponse.json()) as TelegramGetFileResponse;
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
          logError(new Error(fileInfo.description || 'No file path'), '[PROCESO-ON-DEMAND] Error en API de Telegram al obtener información del archivo', { fileId });      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const zipResponse = await fetch(fileUrl);
    if (!zipResponse.ok) {
          logError(new Error(`Error descargando ZIP de Telegram (status: ${zipResponse.status})`), '[PROCESO-ON-DEMAND] Error descargando ZIP de Telegram', { fileId });      return;
    }
    const zipBlob = await zipResponse.blob();

    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();
    const imageEntries = entries.filter(
      (entry) => !entry.directory && /\.(jpe?g|png|webp)$/i.test(entry.filename)
    );

    if (imageEntries.length === 0) {
          logError('No se encontraron imágenes en el ZIP.', '[PROCESO-ON-DEMAND] Procesamiento de capítulo sin imágenes', { seriesSlug, chapterNumber, fileId });      return;
    }

    const pageUploadPromises = imageEntries.map(async (entry) => {
      const pageNumberMatch = entry.filename.match(/(\d+)/);
      if (!pageNumberMatch) return null;
      const pageNumber = parseInt(pageNumberMatch[0], 10);

      if (!isFileEntryWithGetData(entry)) {
        console.warn(
          `[PROCESO-ON-DEMAND] Entry ${entry.filename} is not a file entry with getData.`
        );
        return null;
      }

      const imageBlob = await entry.getData(new BlobWriter());
      const imageBuffer = await imageBlob.arrayBuffer();
      const r2Key = `${seriesSlug}/${chapterNumber}/${entry.filename}`;

      await env.R2_CACHE.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType: imageBlob.type,
          cacheControl: 'public, max-age=86400',
        },
      });
      successfullyUploadedKeys.push(r2Key); // Track successful uploads
      return { pageNumber, r2Key };
    });

    const uploadedPagesData = (await Promise.all(pageUploadPromises)).filter(
      (p) => p !== null
    );

    if (uploadedPagesData.length > 0) {
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
      successfullyUploadedKeys.push(manifestKey); // Also track manifest file
      console.log(
        `[PROCESO-ON-DEMAND] ¡ÉXITO! Manifest creado en CACHÉ para ${manifestKey}`
      );
    }
  } catch (error) {
    logError(error, '[PROCESO-ON-DEMAND] Error crítico procesando el ZIP del capítulo. Iniciando limpieza de R2.', { seriesSlug, chapterNumber, fileId, orphanedKeys: successfullyUploadedKeys });
    if (successfullyUploadedKeys.length > 0) {
      await env.R2_CACHE.delete(successfullyUploadedKeys);
      console.log(`[PROCESO-ON-DEMAND] Limpieza completada. Se eliminaron ${successfullyUploadedKeys.length} archivos huérfanos de R2.`);
    }
  }
}
