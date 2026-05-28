import { defineAction } from 'astro:actions';
import { env } from 'cloudflare:workers';
import { z } from 'astro/zod';

export const reportActions = {
  sendReport: defineAction({
    accept: 'form',
    input: z.object({
      type: z.enum(['chapter_fallen', 'bug', 'claim', 'suggestion']),
      seriesTitle: z.string().optional(),
      chapterNumber: z.string().optional(),
      url: z.string().optional(),
      details: z.string().optional(),
      scanName: z.string().optional(),
      contactInfo: z.string().optional(),
      file: z.any().optional(),
    }),
    handler: async (input, context) => {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      const chatId = env.TELEGRAM_REPORTS_CHAT_ID;

      // Mapeo de tipos a IDs de tópicos (threads) de Telegram desde variables de entorno
      const topicIds: Record<string, string | undefined> = {
        chapter_fallen: env.TELEGRAM_TOPIC_FALLEN,
        bug: env.TELEGRAM_TOPIC_BUGS,
        claim: env.TELEGRAM_TOPIC_CLAIMS,
        suggestion: env.TELEGRAM_TOPIC_SUGGESTIONS,
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
        suggestion: '💡 SUGERENCIA',
      };

      let message = `${typeLabels[input.type]}\n----------------------------\n`;
      if (input.seriesTitle) message += `📚 **Serie:** ${input.seriesTitle}\n`;
      if (input.chapterNumber) message += `🔢 **Capítulo:** ${input.chapterNumber}\n`;
      if (input.scanName) message += `👥 **Scan:** ${input.scanName}\n`;
      if (input.contactInfo) message += `📞 **Contacto:** ${input.contactInfo}\n`;
      if (input.url) message += `🔗 **URL:** ${input.url}\n`;
      message += `👤 **Usuario:** ${context.locals.user?.email || 'Invitado'}\n`;
      if (input.details) message += `📝 **Detalles:**\n${input.details}\n`;

      try {
        let response;
        const file = input.file;
        const hasFile = file && typeof file === 'object' && 'size' in file && file.size > 0;

        if (hasFile) {
          // Enviar archivo adjunto usando FormData
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('message_thread_id', String(threadId));
          formData.append('caption', message);
          formData.append('parse_mode', 'Markdown');
          formData.append('document', file as Blob);

          response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Enviar mensaje de texto normal
          response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_thread_id: threadId,
              text: message,
              parse_mode: 'Markdown',
            }),
          });
        }

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
