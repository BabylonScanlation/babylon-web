// src/pages/api/r2-cache/[...key].ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const { key } = params;
  const { R2_CACHE } = locals.runtime.env;

  if (!key) {
    return new Response('File key is required', { status: 400 });
  }

  try {
    const object = await R2_CACHE.get(key);

    if (object === null) {
      return new Response(`File not found: ${key}`, { status: 404 });
    }

    const headers = new Headers();

    // --- CORRECCIÓN AQUÍ ---
    // Reemplazamos la línea object.writeHttpMetadata(headers); que falla
    // por estas líneas manuales que hacen lo mismo:

    // 1. Copia el Content-Type (ej: "image/jpeg")
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }
    // 2. Copia el ETag (para caché del navegador)
    headers.set('ETag', object.httpEtag);
    // 3. (Opcional) Copia el Cache-Control si existe
    if (object.httpMetadata?.cacheControl) {
      headers.set('Cache-Control', object.httpMetadata.cacheControl);
    }
    // 4. Mantenemos el CORS para desarrollo local
    headers.set('Access-Control-Allow-Origin', '*'); 
    // --- FIN DE LA CORRECCIÓN ---

    // Devuelve el cuerpo del objeto (la imagen)
    return new Response(object.body, {
      headers,
    });

  } catch (error) {
    console.error(`Error fetching R2 object for key ${key}:`, error);
    return new Response('Internal Server Error', { status: 500 });
  }
};