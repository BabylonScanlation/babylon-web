import { createApiRoute } from '../../../../lib/api';
import { series } from '../../../../db/schema';
import { logError } from '../../../../lib/logError';

export const POST = createApiRoute({ auth: 'admin' }, async ({ request, locals }) => {
  const env = locals.runtime.env;
  const db = locals.db;

  try {
    const formData = await request.formData();
    const title = formData.get('title')?.toString().trim();
    let slug = formData.get('slug')?.toString().trim();
    
    if (!title || !slug) {
        return new Response(JSON.stringify({ error: 'El Título y el Slug son campos obligatorios.' }), { status: 400 });
    }

    // Normalizar slug
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const description = formData.get('description')?.toString();
    const coverImageFile = formData.get('coverImage');
    
    let coverImageUrl = formData.get('coverImageUrl')?.toString(); // Fallback por si acaso

    // Lógica de subida de imagen
    if (coverImageFile && coverImageFile instanceof File) {
      const fileExt = coverImageFile.name.split('.').pop() || 'jpg';
      const fileName = `covers/${slug}-${Date.now()}.${fileExt}`;
      
      await env.R2_ASSETS.put(fileName, await coverImageFile.arrayBuffer(), {
        httpMetadata: { contentType: coverImageFile.type }
      });
      
      // Orion: Store relative path
      coverImageUrl = fileName;
    } else if (!coverImageUrl) {
      // Si no hay archivo ni URL, usar placeholder (ruta relativa)
      coverImageUrl = 'covers/placeholder-cover.jpg';
    }

    const status = formData.get('status')?.toString() || null;
    const type = formData.get('type')?.toString() || null;
    const genres = formData.get('genres')?.toString() || null;
    const author = formData.get('author')?.toString() || null;
    const artist = formData.get('artist')?.toString() || null;
    const demographic = formData.get('demographic')?.toString() || null;
    const publishedBy = formData.get('publishedBy')?.toString() || null;
    const alternativeNames = formData.get('alternativeNames')?.toString() || null;
    const serializedBy = formData.get('serializedBy')?.toString() || null;
    const isAppSeries = formData.get('isAppSeries') === 'true';
    const isHidden = formData.get('isHidden') === 'true';
    const isNsfw = formData.get('isNsfw') === 'true';

    const chatId = env.TELEGRAM_CHAT_ID;
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Error de configuración: TELEGRAM_CHAT_ID no está definido en el servidor.' }), { status: 500 });
    }

    const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createForumTopic`;
    const tgResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        name: title
      })
    });

    const tgData: any = await tgResponse.json();

    if (!tgResponse.ok || !tgData.ok) {
      logError(tgData, 'Error al crear el topic en Telegram');
      return new Response(JSON.stringify({ 
        error: 'No se pudo crear el tema en Telegram. Asegúrate de que el bot sea admin y los temas estén activados.',
        details: tgData.description 
      }), { status: 500 });
    }

    const topicId = tgData.result.message_thread_id;

    await db.insert(series).values({
      title,
      slug,
      description,
      coverImageUrl,
      telegramTopicId: topicId,
      status,
      type,
      genres,
      author,
      artist,
      demographic,
      publishedBy,
      alternativeNames,
      serializedBy,
      isAppSeries,
      isHidden,
      isNsfw,
      createdAt: new Date().toISOString()
    });

    return new Response(JSON.stringify({ success: true, topicId }), { status: 201 });

  } catch (error) {
    logError(error, 'Error crítico al crear la serie desde el panel admin');
    return new Response(JSON.stringify({ error: 'Ocurrió un error interno en el servidor.' }), { status: 500 });
  }
});
