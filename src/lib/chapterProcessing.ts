import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { type Entry, HttpReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { eq } from 'drizzle-orm';
import pLimit from 'p-limit';
import { chapters } from '../db/schema';
import { getDB } from './db';
import { logError } from './logError';

interface RuntimeEnv {
  DB: D1Database;
  R2_CACHE: R2Bucket;
  R2_ASSETS: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  R2_PUBLIC_URL_CACHE: string;
  R2_PUBLIC_URL_ASSETS: string;
}

export async function processAndCacheChapter(
  env: RuntimeEnv,
  fileId: string,
  seriesSlugParam: string,
  chapterNumber: number,
  chapterId: number
) {
  const slug = String(seriesSlugParam || '');
  if (!slug) throw new Error('Series slug is required');

  const drizzleDb = getDB(env);

  try {
    const isDev =
      process.env.NODE_ENV === 'development' ||
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV);
    const concurrency = isDev ? 4 : 10;
    const limit = pLimit(concurrency);

    console.log(`[PROCESO] Iniciando Lightspeed para capítulo ID: ${chapterId}`);

    const fileInfoUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    let rawFileInfo: {
      ok: boolean;
      result?: { file_path: string };
      description?: string;
    } | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(fileInfoUrl);
        if (response.ok) {
          rawFileInfo = (await response.json()) as {
            ok: boolean;
            result?: { file_path: string };
            description?: string;
          };
          break;
        }
      } catch (err) {
        if (i === 2) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!rawFileInfo?.ok || !rawFileInfo?.result?.file_path) {
      throw new Error(
        rawFileInfo?.description || 'No se pudo obtener la ruta del archivo de Telegram'
      );
    }

    const filePath = rawFileInfo.result.file_path;
    if (!filePath) throw new Error('Telegram file path missing');

    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const zipReader = new ZipReader(new HttpReader(fileUrl));
    const entries: Entry[] = await zipReader.getEntries();

    const imageEntries = entries.filter(
      (entry) => !entry.directory && /\.(jpe?g|png|webp)$/i.test(entry.filename)
    );

    if (imageEntries.length === 0) throw new Error('No se encontraron imágenes en el ZIP.');

    const versionHash = Date.now().toString(36);
    const manifestKey = `series_manifest/${slug}/${String(chapterNumber)}/manifest.json`;

    // --- FASE 0: VALIDACIÓN DE CAMBIOS (DE-DUPLICACIÓN) ---
    try {
      const existingManifestObj = await env.R2_ASSETS.get(manifestKey);
      if (existingManifestObj) {
        const existingManifest = (await existingManifestObj.json()) as any;
        if (existingManifest?.sourceFileId === fileId) {
          console.log(
            `[PROCESO] ⚡ El archivo de Telegram es idéntico al procesado anteriormente (${fileId}). Saltando recarga.`
          );
          await drizzleDb
            .update(chapters)
            .set({ status: 'live' })
            .where(eq(chapters.id, chapterId))
            .run();
          await zipReader.close();
          return;
        }
      }
    } catch (e) {
      console.warn('[PROCESO] No se pudo verificar manifest previo, procediendo con carga completa.');
    }

    // --- FASE A: VIRTUAL MANIFEST ---
    const virtualPages = imageEntries
      .map((entry: Entry) => {
        const name = entry.filename;
        if (!name) return null;

        const allNumbers = name.match(/(\d+)/g);
        if (!allNumbers || allNumbers.length === 0) return null;

        const lastNumber = allNumbers[allNumbers.length - 1] as string;
        const pageNumber = parseInt(lastNumber, 10);
        const r2Key = `series_manifest/${slug}/${chapterNumber}/${versionHash}/${name}`;
        return { pageNumber, imageUrl: `/api/r2-cache/${r2Key}` };
      })
      .filter((p): p is { pageNumber: number; imageUrl: string } => p !== null)
      .sort((a, b) => a.pageNumber - b.pageNumber);

    if (virtualPages.length > 0) {
      const manifestBody = JSON.stringify({
        version: '2.1-virtual',
        vHash: versionHash,
        sourceFileId: fileId, // Orion: Guardamos el ID de origen para futuras comparaciones
        pages: virtualPages,
      });

      // 1. Subir a R2_ASSETS (Única fuente de verdad para el manifest)
      await env.R2_ASSETS.put(manifestKey, manifestBody, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });

      console.log(`[LIGHTSPEED] ⚡ Manifest persistente subido a ASSETS para capítulo ${chapterId}`);
    }

    // --- FASE B: BACKGROUND FILL ---
    const pageUploadPromises = imageEntries.map((entry: Entry) =>
      limit(async () => {
        const name = entry.filename;
        if (!name) return null;

        const fileName = name;
        try {
          // Verificamos que sea un archivo y tenga el método getData
          if (
            !('getData' in entry) ||
            typeof (entry as { getData?: unknown }).getData !== 'function'
          )
            return null;

          const r2Key = `series_manifest/${slug}/${String(chapterNumber)}/${versionHash}/${fileName}`;
          const imageBuffer = await (
            entry as { getData: (writer: unknown) => Promise<Uint8Array> }
          ).getData(new Uint8ArrayWriter());

          const contentType = fileName.toLowerCase().endsWith('.webp')
            ? 'image/webp'
            : fileName.toLowerCase().endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          let uploadSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              // 1. Subir a R2_ASSETS (Permanente)
              await env.R2_ASSETS.put(r2Key, imageBuffer, {
                httpMetadata: {
                  contentType,
                  cacheControl: 'public, max-age=31536000, immutable',
                },
                customMetadata: { version: versionHash },
              });

              // 2. Subir a R2_CACHE (Temporal/Capa de entrega rápida)
              await env.R2_CACHE.put(r2Key, imageBuffer, {
                httpMetadata: {
                  contentType,
                  cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable',
                },
                customMetadata: { version: versionHash },
              });

              uploadSuccess = true;
              break;
            } catch {
              if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
            }
          }
          return uploadSuccess ? true : null;
        } catch (err) {
          logError(err, '[UPLOAD] Fallo en página', { filename: fileName });
          return null;
        }
      })
    );

    await Promise.all(pageUploadPromises);
    console.log(`[PROCESO] ✅ Subida de imágenes completada para ${chapterId}`);

    // --- FASE C: LIMPIEZA DE VERSIONES ANTIGUAS (ORDEN TOTAL) ---
    try {
      const prefix = `series_manifest/${slug}/${chapterNumber}/`;
      const objects = await env.R2_ASSETS.list({ prefix });
      
      const deletePromises = objects.objects
        .filter(obj => {
          // No borrar el manifest.json que acabamos de subir
          if (obj.key === manifestKey) return false;
          // No borrar nada que pertenezca a la versión actual
          if (obj.key.includes(`/${versionHash}/`)) return false;
          return true;
        })
        .map(obj => env.R2_ASSETS.delete(obj.key));

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`[PROCESO] 🧹 Limpieza completada: ${deletePromises.length} archivos antiguos eliminados.`);
      }
    } catch (cleanErr) {
      console.warn('[PROCESO] No se pudo completar la limpieza de archivos antiguos:', cleanErr);
    }

    // Limpieza de DB y marcar como LIVE
    try {
      await drizzleDb.delete(pagesTable).where(eq(pagesTable.chapterId, chapterId)).run();
    } catch (dbErr) {
      console.warn(
        `[PROCESO] No se pudieron limpiar páginas antiguas en DB para ${chapterId}`,
        dbErr
      );
    }

    await drizzleDb
      .update(chapters)
      .set({ status: 'live' })
      .where(eq(chapters.id, chapterId))
      .run();

    await zipReader.close();
  } catch (error) {
    logError(error, '[PROCESO] Error crítico', { seriesSlug: slug, chapterNumber, chapterId });
    try {
      await drizzleDb
        .update(chapters)
        .set({ status: 'live' })
        .where(eq(chapters.id, chapterId))
        .run();
    } catch (dbErr) {
      console.error(`[PROCESO] Fallo fatal al intentar revertir status para ${chapterId}`, dbErr);
    }
  }
}
