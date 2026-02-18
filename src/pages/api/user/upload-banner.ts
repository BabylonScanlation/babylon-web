import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !user.uid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('banner') as File;

    if (!file || !file.name) {
      return new Response(JSON.stringify({ error: 'No se seleccionó ninguna imagen.' }), { status: 400 });
    }

    // 1. Validaciones
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: 'Formato no soportado. Usa JPG, PNG o WEBP.' }), { status: 400 });
    }

    if (file.size > 4 * 1024 * 1024) { // 4MB Limit for banners (usually larger than avatars)
      return new Response(JSON.stringify({ error: 'La imagen es demasiado pesada (Máx 4MB).' }), { status: 400 });
    }

    const { env } = locals.runtime;
    const db = getDB(env);

    // 2. Obtener banner anterior para limpieza
    const currentUser = await db.select({ bannerUrl: users.bannerUrl }).from(users).where(eq(users.id, user.uid)).get();
    
    if (currentUser?.bannerUrl) {
        try {
            const urlObj = new URL(currentUser.bannerUrl);
            const key = urlObj.pathname.substring(1);
            if (key.startsWith('banners/')) {
                await env.R2_ASSETS.delete(key);
            }
        } catch (err) {
            console.warn('No se pudo borrar el banner anterior:', err);
        }
    }

    // 3. Preparar nueva subida
    const ext = file.type.split('/')[1];
    const timestamp = Date.now();
    const key = `banners/${user.uid}-${timestamp}.${ext}`;

    // 4. Subir a R2_ASSETS
    await env.R2_ASSETS.put(key, file, {
        httpMetadata: {
            contentType: file.type,
            cacheControl: 'public, max-age=31536000' 
        }
    });

    const publicUrl = `${env.R2_PUBLIC_URL_ASSETS}/${key}`;

    // 5. Actualizar Base de Datos
    await db.insert(users).values({
        id: user.uid,
        email: user.email || 'no-email',
        bannerUrl: publicUrl,
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: users.id,
        set: {
            bannerUrl: publicUrl,
            updatedAt: new Date()
        }
    }).run();

    return new Response(JSON.stringify({ success: true, bannerUrl: publicUrl }), { status: 200 });

  } catch (e) {
    console.error('Banner Upload Error:', e);
    return new Response(JSON.stringify({ error: 'Error interno al subir el banner.' }), { status: 500 });
  }
};