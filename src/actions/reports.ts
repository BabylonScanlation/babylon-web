import { defineAction } from 'astro:actions';
import { env } from 'cloudflare:workers';
import { z } from 'astro/zod';

export const reportActions = {
  sendReport: defineAction({
    input: z.object({
      type: z.enum(['chapter_fallen', 'bug', 'claim']),
      seriesTitle: z.string(),
      chapterNumber: z.string(),
      url: z.string(),
      details: z.string().optional(),
    }),
    handler: async (input, context) => {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      const chatId = env.TELEGRAM_REPORTS_CHAT_ID;

      // Mapeo de tipos a IDs de tópicos (threads) de Telegram
      const topicIds: Record<string, string | undefined> = {
        chapter_fallen: env.TELEGRAM_TOPIC_FALLEN,
        bug: env.TELEGRAM_TOPIC_BUGS,
        claim: env.TELEGRAM_TOPIC_CLAIMS,
      };

      const threadId = topicIds[input.type];

      // Si faltan variables críticas, fallamos con gracia
      if (!botToken || !chatId) {
        console.warn('[Reports] Telegram env vars missing. Skipping message.');
        return { success: false, error: 'Configuración de reportes incompleta en el servidor' };
      }

      const typeLabels = {
        chapter_fallen: '❌ CAPÍTULO CAÍDO',
        bug: '🐛 BUG / ERROR',
        claim: '⚖️ RECLAMACIÓN',
      };

      const message = `
${typeLabels[input.type]}
----------------------------
📚 **Serie:** ${input.seriesTitle}
🔢 **Capítulo:** ${input.chapterNumber}
🔗 **URL:** ${input.url}
👤 **Usuario:** ${context.locals.user?.email || 'Invitado'}
📝 **Detalles:** ${input.details || 'Sin detalles adicionales'}
      `;

      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_thread_id: threadId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[Telegram API Error]:', errorData);
          throw new Error('Telegram API error');
        }

        return { success: true };
      } catch (e) {
        console.error('[Reports Action Error]:', e);
        return { success: false, error: 'Error al enviar el reporte a Telegram' };
      }
    },
  }),
};
