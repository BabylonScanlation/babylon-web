import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { scanlations } from '../../db/schema';
import { getDB } from '../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const { env } = locals.runtime;
    const db = getDB(env);

    // Verificamos si es un mensaje con el comando de vinculación
    // Formato esperado: /start link_SCANID_TOKEN
    const message = body.message || body.channel_post;
    if (!message || !message.text) return new Response('OK');

    const text = message.text as string;
    if (text.startsWith('/vincular')) {
      const parts = text.split(' ');
      if (parts.length < 2) return new Response('OK');

      const token = parts[1];
      if (!token) return new Response('OK');

      const chatId = message.chat.id.toString();

      // Buscamos el scanlation que tenga ese token
      const scan = await db
        .select()
        .from(scanlations)
        .where(eq(scanlations.telegramLinkToken, token))
        .get();

      if (scan) {
        // Vinculamos!
        await db
          .update(scanlations)
          .set({
            telegramChatId: chatId,
            telegramLinkToken: null, // Quemamos el token por seguridad
          })
          .where(eq(scanlations.id, scan.id))
          .run();

        // Respondemos a Telegram para confirmar al usuario
        const botToken = env.TELEGRAM_BOT_TOKEN;
        const confirmMsg = `✅ ¡Éxito! Este canal ha sido vinculado a *${scan.name}*. 
        
A partir de ahora, todas las series creadas por este grupo generarán un Topic aquí automáticamente.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: confirmMsg,
            parse_mode: 'Markdown',
          }),
        });
      }
    }

    return new Response('OK');
  } catch (err) {
    console.error('[TG Webhook Error]', err);
    return new Response('Error', { status: 500 });
  }
};
