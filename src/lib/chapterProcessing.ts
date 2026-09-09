import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { type Entry, HttpReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';
import { eq } from 'drizzle-orm';
import pLimit from 'p-limit';
import { chapters, pages } from '../db/schema';
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

    // Orion: Obtener isNsfw de la BD para la ruta de carpetas (0 o 1)
    const chapterData = await drizzleDb
      .select({ isNsfw: chapters.isNsfw })
      .from(chapters)
      .where(eq(chapters.id, chapterId))
      .get();

    const nsfwFolder = chapterData?.isNsfw ? '1' : '0';
    const versionHash = Date.now().toString(36);
    const manifestKey = `series_manifest/${slug}/${chapterNumber}/${nsfwFolder}/manifest.json`;

    // --- FASE 0: VALIDACIÓN DE CAMBIOS (DE-DUPLICACIÓN) ---
    try {
      const existingManifestObj = await env.R2_ASSETS.get(manifestKey);
      if (existingManifestObj) {
        const existingManifest = (await existingManifestObj.json()) as { sourceFileId?: string };
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
    } catch {
      console.warn(
        '[PROCESO] No se pudo verificar manifest previo, procediendo con carga completa.'
      );
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

        const extMatch = name.match(/\.(jpe?g|png|webp)$/i);
        const ext = extMatch?.[1] ? extMatch[1].toLowerCase() : 'webp';
        const cleanExt = ext === 'jpeg' ? 'jpg' : ext;

        const r2Key = `${slug}/${chapterNumber}/${nsfwFolder}/${pageNumber}.${cleanExt}`;

        return {
          pageNumber,
          imageUrl: `/api/r2-cache/${r2Key}`,
          originalName: name,
          r2Key,
          cleanExt,
        };
      })
      .filter(
        (
          p
        ): p is {
          pageNumber: number;
          imageUrl: string;
          originalName: string;
          r2Key: string;
          cleanExt: string;
        } => p !== null
      )
      .sort((a, b) => a.pageNumber - b.pageNumber);

    if (virtualPages.length > 0) {
      const manifestBody = JSON.stringify({
        version: '3.0-clean-paths',
        vHash: versionHash,
        sourceFileId: fileId,
        pages: virtualPages.map((p) => ({ pageNumber: p.pageNumber, imageUrl: p.imageUrl })),
      });

      // 1. Subir a R2_ASSETS (Única fuente de verdad para el manifest)
      await env.R2_ASSETS.put(manifestKey, manifestBody, {
        httpMetadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });

      console.log(
        `[LIGHTSPEED] ⚡ Manifest persistente subido a ASSETS para capítulo ${chapterId}`
      );
    }

    // --- FASE B: BACKGROUND FILL ---
    const pageUploadPromises = virtualPages.map((vp) =>
      limit(async () => {
        const entry = imageEntries.find((e) => e.filename === vp.originalName);
        if (!entry) return null;

        try {
          // Verificamos que sea un archivo y tenga el método getData
          if (
            !('getData' in entry) ||
            typeof (entry as { getData?: unknown }).getData !== 'function'
          )
            return null;

          const r2Key = vp.r2Key;
          const imageBuffer = await (
            entry as { getData: (writer: unknown) => Promise<Uint8Array> }
          ).getData(new Uint8ArrayWriter());

          const contentType =
            vp.cleanExt === 'webp'
              ? 'image/webp'
              : vp.cleanExt === 'png'
                ? 'image/png'
                : 'image/jpeg';

          let uploadSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              // SOLO SUBIR A R2_CACHE
              await env.R2_CACHE.put(r2Key, imageBuffer, {
                httpMetadata: {
                  contentType,
                  cacheControl: 'public, max-age=31536000, s-maxage=2592000, immutable',
                },
              });

              uploadSuccess = true;
              break;
            } catch {
              if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
            }
          }
          return uploadSuccess ? true : null;
        } catch (err) {
          logError(err, '[UPLOAD] Fallo en página', { filename: vp.originalName });
          return null;
        }
      })
    );

    await Promise.all(pageUploadPromises);
    console.log(`[PROCESO] ✅ Subida de imágenes completada para ${chapterId}`);

    // --- FASE C: LIMPIEZA DE VERSIONES ANTIGUAS (ORDEN TOTAL EN CACHE) ---
    try {
      const prefix = `${slug}/${chapterNumber}/${nsfwFolder}/`;
      const objects = await env.R2_CACHE.list({ prefix });

      const newKeys = new Set(virtualPages.map((vp) => vp.r2Key));

      const deletePromises = objects.objects
        .filter((obj) => !newKeys.has(obj.key))
        .map((obj) => env.R2_CACHE.delete(obj.key));

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(
          `[PROCESO] 🧹 Limpieza completada: ${deletePromises.length} archivos antiguos eliminados de CACHE.`
        );
      }
    } catch (cleanErr) {
      console.warn('[PROCESO] No se pudo completar la limpieza de archivos antiguos:', cleanErr);
    }

    // Limpieza de DB y marcar como LIVE
    try {
      await drizzleDb.delete(pages).where(eq(pages.chapterId, chapterId)).run();
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
      // Limpiamos cualquier manifest incompleto para evitar que el lector
      // consuma un capítulo a medio procesar. Con status 'live' y sin manifest,
      // el healing del lector reintentará el procesamiento en la siguiente visita.
      const manifestKeys = [
        `series_manifest/${slug}/${chapterNumber}/0/manifest.json`,
        `series_manifest/${slug}/${chapterNumber}/1/manifest.json`,
        `series_manifest/${slug}/${chapterId}/manifest.json`,
      ];
      await env.R2_ASSETS.delete(manifestKeys).catch(() => {});

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
