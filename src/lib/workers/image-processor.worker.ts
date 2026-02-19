/// <reference lib="webworker" />

// src/lib/workers/image-processor.worker.ts
// ORION: Versión optimizada - Solo procesamiento de imagen única (Single WebP)

self.onmessage = async (e: MessageEvent) => {
  const { data, watermark } = e.data;

  // console.debug(`[Worker] Received task for: ${data.url ? data.url.split('/').pop() : 'unknown'}`);

  try {
    if (!data.url) throw new Error('Missing image URL');

    // console.time(`[Worker] Process ${data.url.split('/').pop()}`);
    const blob = await fetchBlob(data.url);
    const sourceBitmap = await createImageBitmap(blob);
    const width = sourceBitmap.width;
    const height = sourceBitmap.height;

    // Create OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');

    // Draw image
    ctx.drawImage(sourceBitmap, 0, 0);

    // Draw Watermark
    if (watermark) {
      drawWatermark(ctx, width, height, watermark);
    }

    // Transfer bitmap back
    const bitmap = canvas.transferToImageBitmap();
    sourceBitmap.close(); // Clean up source

    // console.timeEnd(`[Worker] Process ${data.url.split('/').pop()}`);
    (self as any).postMessage({ success: true, bitmap }, [bitmap]);
  } catch (error: any) {
    console.error(`[Worker] Error processing ${data.url}:`, error);
    (self as any).postMessage({ success: false, error: error.message });
  }
};

async function fetchBlob(url: string): Promise<Blob> {
  // console.debug(`[Worker] Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[Worker] Fetch failed: ${res.status} ${res.statusText} for ${url}`);
    throw new Error(`Failed to load ${url}: ${res.status}`);
  }
  // console.debug(`[Worker] Fetch success: ${url} (${res.headers.get('content-length')} bytes)`);
  return res.blob();
}

function drawWatermark(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
) {
  ctx.save();
  const fontSize = Math.max(width / 25, 20);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const angle = (-30 * Math.PI) / 180;

  // Orion: Ajuste de densidad para que no sea excesivo pero cubra el ancho
  const stepX = fontSize * 20;
  const stepY = fontSize * 15;

  for (let y = fontSize * 2; y < height + stepY; y += stepY) {
    // Orion: Aplicamos un desplazamiento (offset) en cada fila
    // para que las marcas de agua no estén alineadas en columnas perfectas
    // Esto ayuda a que "conecten" mejor visualmente entre páginas.
    const isOdd = Math.floor(y / stepY) % 2 !== 0;
    const xOffset = isOdd ? stepX / 2 : 0;

    for (let x = xOffset; x < width + stepX; x += stepX) {
      ctx.save();
      // Si x es 0, le damos un margen para que no se corte el texto
      const posX = x === 0 ? fontSize * 4 : x;
      ctx.translate(posX, y);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; // Un pelín más transparente
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}
