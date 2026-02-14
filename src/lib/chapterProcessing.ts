import { ZipReader, HttpReader, Uint8ArrayWriter, type Entry } from '@zip.js/zip.js';
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

export async function processAndCacheChapter(
  env: RuntimeEnv,
  fileId: string,
  seriesSlug: string,
  chapterNumber: number,
  chapterId: number
) {
  const drizzleDb = getDB(env);

  try {
    const isDev = process.env.NODE_ENV === 'development' || (typeof import.meta !== 'undefined' && import.meta.env?.DEV);
    const concurrency = isDev ? 4 : 10;
    const limit = pLimit(concurrency);
    
    console.log(`[PROCESO] Iniciando Lightspeed para capítulo ID: ${chapterId}`);

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    let rawFileInfo;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(fileInfoUrl);
        if (response.ok) {
          rawFileInfo = await response.json();
          break;
        }
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
    const entries: Entry[] = await zipReader.getEntries();
    
    const imageEntries = entries.filter(
      (entry) => !entry.directory && /\.(jpe?g|png|webp)$/i.test(entry.filename)
    );

    if (imageEntries.length === 0) throw new Error('No se encontraron imágenes en el ZIP.');

    const versionHash = Date.now().toString(36);
    const manifestKey = `${seriesSlug}/${chapterNumber}/manifest.json`;

    // --- FASE A: VIRTUAL MANIFEST ---
    const virtualPages = imageEntries
        .map((entry) => {
            const cleanName = entry.filename.replace(/11zon/gi, '');
            const allNumbers = cleanName.match(/(\d+)/g);
            if (!allNumbers) return null;
            const pageNumber = parseInt(allNumbers[allNumbers.length - 1], 10);
            const r2Key = `${seriesSlug}/${chapterNumber}/${versionHash}/${entry.filename || 'unknown'}`;
            return { pageNumber, imageUrl: `/api/r2-cache/${r2Key}` };
        })
        .filter((p): p is { pageNumber: number, imageUrl: string } => p !== null)
        .sort((a, b) => a.pageNumber - b.pageNumber);

    if (virtualPages.length > 0) {
        await env.R2_CACHE.put(manifestKey, JSON.stringify({ 
            version: "2.1-virtual", 
            vHash: versionHash, 
            pages: virtualPages 
        }), {
            httpMetadata: { contentType: 'application/json', cacheControl: 'no-cache, no-store, must-revalidate' },
        });
        console.log(`[LIGHTSPEED] ⚡ Virtual Manifest subido para capítulo ${chapterId}`);
    }

    // --- FASE B: BACKGROUND FILL ---
    const pageUploadPromises = imageEntries.map((entry: Entry) => limit(async () => {
      const cleanName = entry.filename.replace(/11zon/gi, '');
      const allNumbers = cleanName.match(/(\d+)/g);
      if (!allNumbers) return null;
      
      try {
          if (!entry.getData) return null;
          const r2Key = `${seriesSlug}/${chapterNumber}/${versionHash}/${entry.filename}`;
          const imageBuffer = await entry.getData(new Uint8ArrayWriter());
          
          let uploadSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                  await env.R2_CACHE.put(r2Key, imageBuffer, {
                    httpMetadata: {
                      contentType: entry.filename.toLowerCase().endsWith('.webp') ? 'image/webp' : 
                                   entry.filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
                      cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable', 
                    },
                    customMetadata: { version: versionHash }
                  });
                  uploadSuccess = true;
                  break; 
              } catch {
                  if (attempt < 3) await new Promise(r => setTimeout(r, 1000)); 
              }
          }
          return uploadSuccess ? true : null;
      } catch (err) {
          logError(err, '[UPLOAD] Fallo en página', { filename: String(entry.filename) });
          return null;
      }
    }));

    await Promise.all(pageUploadPromises);
    console.log(`[PROCESO] ✅ Subida de imágenes completada para ${chapterId}`);

    // Limpieza y marcar como LIVE
    const { pages: pagesTable } = await import('../db/schema');
    try {
        await drizzleDb.delete(pagesTable).where(eq(pagesTable.chapterId, chapterId)).run();
    } catch (dbErr) { 
        console.warn(`[PROCESO] No se pudieron limpiar páginas antiguas en DB para ${chapterId}`, dbErr);
    }

    await drizzleDb.update(chapters).set({ status: 'live' }).where(eq(chapters.id, chapterId)).run();

    await zipReader.close();
  } catch (error) {
    logError(error, '[PROCESO] Error crítico', { seriesSlug, chapterNumber, chapterId });
    try {
        await drizzleDb.update(chapters).set({ status: 'live' }).where(eq(chapters.id, chapterId)).run();
    } catch (dbErr) {
        console.error(`[PROCESO] Fallo fatal al intentar revertir status para ${chapterId}`, dbErr);
    }
  }
}
