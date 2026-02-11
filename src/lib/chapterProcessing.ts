import { ZipReader, HttpReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import pLimit from 'p-limit';
import { logError } from './logError';
import { getDB } from './db';
import { chapters } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    fileId: string;
    fileUniqueId: string;
    fileSize?: number;
    filePath?: string;
  };
  description?: string;
}

export async function processAndCacheChapter(
  env: RuntimeEnv,
  fileId: string,
  seriesSlug: string,
  chapterNumber: number,
  chapterId: number
) {
  const successfullyUploadedKeys: string[] = [];
  const drizzleDb = getDB(env);

  try {
    const isDev = process.env.NODE_ENV === 'development' || (typeof import.meta !== 'undefined' && import.meta.env?.DEV);
    
    // ESTRATEGIA DE CONCURRENCIA: 1 en local para evitar ECONNRESET, 10 en prod para velocidad.
    const concurrency = isDev ? 1 : 10;
    const limit = pLimit(concurrency);
    
    console.log(`[PROCESO] Iniciando con concurrencia: ${concurrency} (${isDev ? 'Local' : 'Prod'}) para capítulo ID: ${chapterId}`);

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    const rawFileInfo = (await fileInfoResponse.json()) as any;
    
    if (!rawFileInfo.ok || !rawFileInfo.result || !rawFileInfo.result.file_path) {
      throw new Error(rawFileInfo.description || 'No se pudo obtener la ruta del archivo de Telegram');
    }

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${rawFileInfo.result.file_path}`;
    const zipReader = new ZipReader(new HttpReader(fileUrl));
    const entries = await zipReader.getEntries();
    
    const imageEntries = entries.filter(
      (entry) => !entry.directory && /\.(jpe?g|png|webp)$/i.test(entry.filename)
    );

    if (imageEntries.length === 0) {
      throw new Error('No se encontraron imágenes en el ZIP.');
    }

    const pageUploadPromises = imageEntries.map((entry: any) => limit(async () => {
      // ORION: Extraer el ÚLTIMO grupo de números del nombre (evita confundirse con el número de capítulo)
      const allNumbers = entry.filename.match(/(\d+)/g);
      if (!allNumbers) {
          console.warn(`[PROCESO] Ignorando archivo sin números: ${entry.filename}`);
          return null;
      }
      
      const pageNumber = parseInt(allNumbers[allNumbers.length - 1], 10);
      console.log(`[PROCESO] Archivo: ${entry.filename} -> Detectada Página: ${pageNumber}`);
      
      try {
          if (!entry.getData) return null;
          const imageBuffer = await entry.getData(new Uint8ArrayWriter());
          const r2Key = `${seriesSlug}/${chapterNumber}/${entry.filename}`;
          
          let uploadSuccess = false;
          let lastError;
          
          for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                  await env.R2_CACHE.put(r2Key, imageBuffer, {
                    httpMetadata: {
                      contentType: entry.filename.endsWith('.webp') ? 'image/webp' : 
                                   entry.filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
                      cacheControl: 'public, max-age=86400',
                    },
                  });
                  uploadSuccess = true;
                  break; 
              } catch (e) {
                  lastError = e;
                  if (attempt < 3) await new Promise(r => setTimeout(r, isDev ? 1500 : 200)); 
              }
          }

          if (!uploadSuccess) throw lastError;

          successfullyUploadedKeys.push(r2Key);
          return { pageNumber, imageUrl: `/api/r2-cache/${r2Key}` };
      } catch (err) {
          logError(err, '[UPLOAD] Fallo tras reintentos', { filename: entry.filename });
          return null;
      }
    }));

    const results = await Promise.all(pageUploadPromises);
    const uploadedPagesData = results.filter((p): p is { pageNumber: number, imageUrl: string } => p !== null);

    if (uploadedPagesData.length > 0) {
      console.log(`[PROCESO] Ordenando ${uploadedPagesData.length} páginas...`);
      const manifestKey = `${seriesSlug}/${chapterNumber}/manifest.json`;
      const pages = uploadedPagesData.sort((a, b) => a.pageNumber - b.pageNumber);
      
      console.log('[PROCESO] Secuencia final generada:', pages.map(p => p.pageNumber).join(', '));

      await env.R2_CACHE.put(manifestKey, JSON.stringify({ version: "2.0", pages }), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=86400' },
      });
      successfullyUploadedKeys.push(manifestKey);
      
      // MARCAR COMO LIVE AL TERMINAR
      await drizzleDb.update(chapters)
        .set({ status: 'live' })
        .where(eq(chapters.id, chapterId))
        .run();

      console.log(`[PROCESO] ✅ Capítulo ${chapterId} completado y marcado como LIVE.`);
    }

    await zipReader.close();
  } catch (error) {
    logError(error, '[PROCESO] Error crítico. Revirtiendo status a LIVE para reintento.', { seriesSlug, chapterNumber, fileId, chapterId });
    
    // REVERTIR A LIVE PARA QUE OTRO INTENTO PUEDA DISPARAR EL PROCESO (o el mismo)
    try {
        await drizzleDb.update(chapters)
            .set({ status: 'live' })
            .where(eq(chapters.id, chapterId))
            .run();
    } catch (dbErr) {
        console.error('Error fatal al intentar revertir status en DB:', dbErr);
    }

    if (successfullyUploadedKeys.length > 0) {
      try { 
        await env.R2_CACHE.delete(successfullyUploadedKeys); 
      } catch (_e) {
        // Silently fail if cleanup fails
        console.debug('Failed to cleanup R2 keys', _e);
      }
    }
  }
}