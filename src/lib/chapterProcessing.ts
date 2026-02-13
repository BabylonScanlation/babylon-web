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
    
    // ESTRATEGIA DE CONCURRENCIA: 4 en local (balanceado), 10 en prod para velocidad máxima.
    const concurrency = isDev ? 4 : 10;
    const limit = pLimit(concurrency);
    
    console.log(`[PROCESO] Iniciando con concurrencia: ${concurrency} (${isDev ? 'Local' : 'Prod'}) para capítulo ID: ${chapterId}`);

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    
    // ORION: Retry logic for Telegram API
    let rawFileInfo;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(fileInfoUrl);
        if (response.ok) {
          rawFileInfo = await response.json();
          break;
        }
        throw new Error(`Telegram API Error: ${response.status}`);
      } catch (err) {
        if (i === 2) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    if (!rawFileInfo?.ok || !rawFileInfo?.result?.file_path) {
      throw new Error(rawFileInfo?.description || 'No se pudo obtener la ruta del archivo de Telegram');
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

    // ORION: INVALIDACIÓN EXTREMA - Generamos un hash de versión único para esta subida
    // Usamos el ID del capítulo + timestamp para garantizar unicidad absoluta
    const versionHash = Date.now().toString(36);
    const manifestKey = `${seriesSlug}/${chapterNumber}/manifest.json`;

    // 1. Borramos el manifiesto antiguo inmediatamente para evitar que alguien lea datos viejos mientras procesamos
    try {
        await env.R2_CACHE.delete(manifestKey);
    } catch (e) { /* ignore if not exists */ }

    const pageUploadPromises = imageEntries.map((entry: any) => limit(async () => {
      // ORION: Limpiamos el nombre de interferencias comunes como '11zon'
      const cleanName = entry.filename.replace(/11zon/gi, '');
      const allNumbers = cleanName.match(/(\d+)/g);
      if (!allNumbers) return null;
      
      // Si hay varios números, intentamos evitar el número del capítulo si es posible
      // Pero por ahora, el último número tras la limpieza suele ser el correcto (ej. 46-1 -> 1)
      const pageNumber = parseInt(allNumbers[allNumbers.length - 1], 10);
      
      try {
          if (!entry.getData) return null;
          const imageBuffer = await entry.getData(new Uint8ArrayWriter());
          
          // RUTA CON HASH DE VERSIÓN: serie/capitulo/hash/imagen.webp
          const r2Key = `${seriesSlug}/${chapterNumber}/${versionHash}/${entry.filename}`;
          
          let uploadSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                  await env.R2_CACHE.put(r2Key, imageBuffer, {
                    httpMetadata: {
                      contentType: entry.filename.endsWith('.webp') ? 'image/webp' : 
                                   entry.filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
                      // Cache control corto para permitir actualizaciones si fuera necesario
                      cacheControl: 'public, max-age=3600, s-maxage=3600', 
                    },
                    customMetadata: { version: versionHash }
                  });
                  uploadSuccess = true;
                  break; 
              } catch (e) {
                  if (attempt < 3) await new Promise(r => setTimeout(r, 500)); 
              }
          }

          if (!uploadSuccess) throw new Error(`Fallo subir a R2: ${r2Key}`);

          return { pageNumber, imageUrl: `/api/r2-cache/${r2Key}` };
      } catch (err) {
          logError(err, '[UPLOAD] Fallo crítico en página', { filename: entry.filename });
          return null;
      }
    }));

    const results = await Promise.all(pageUploadPromises);
    const uploadedPagesData = results.filter((p): p is { pageNumber: number, imageUrl: string } => p !== null);

    if (uploadedPagesData.length > 0) {
      const pages = uploadedPagesData.sort((a, b) => a.pageNumber - b.pageNumber);
      
      // 2. LIMPIEZA DE DB: Borramos páginas antiguas antes de insertar el nuevo manifiesto
      // Esto evita que queden huérfanos o datos mezclados.
      const { pages: pagesTable } = await import('../db/schema');
      try {
          await drizzleDb.delete(pagesTable).where(eq(pagesTable.chapterId, chapterId)).run();
      } catch (dbErr) {
          console.warn('[PROCESO] No se pudieron borrar páginas antiguas (D1 Busy?), continuando...');
      }

      // 3. SUBIDA DEL MANIFIESTO CON HASH
      await env.R2_CACHE.put(manifestKey, JSON.stringify({ 
          version: "2.1", 
          vHash: versionHash, 
          pages 
      }), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache, no-store, must-revalidate' },
      });
      
      // MARCAR COMO LIVE (Con Retries)
      let marked = false;
      for (let i = 0; i < 5; i++) {
          try {
              await drizzleDb.update(chapters)
                .set({ status: 'live' })
                .where(eq(chapters.id, chapterId))
                .run();
              marked = true;
              break;
          } catch (dbErr) {
              console.warn(`[PROCESO] Fallo al marcar LIVE (Intento ${i+1}):`, dbErr);
              await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
          }
      }
      
      if (!marked) {
          console.error(`[PROCESO] CRÍTICO: El capítulo ${chapterId} se subió pero no se pudo marcar como LIVE en la DB.`);
          // No lanzamos error aquí para evitar que el bloque catch inferior borre los archivos de R2
          // Es mejor que quede "processing" pero con archivos, a que se borre todo.
      } else {
          console.log(`[PROCESO] ✅ Capítulo ${chapterId} completado y marcado como LIVE.`);
      }
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