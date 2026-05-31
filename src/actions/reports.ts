import { defineAction } from 'astro:actions';
import { env } from 'cloudflare:workers';
import { z } from 'astro/zod';
import { asc, eq } from 'drizzle-orm';
import { chapters, series } from '../db/schema';
import { getDB } from '../lib/db';

export const reportActions = {
  getSeriesList: defineAction({
    handler: async (_, context) => {
      try {
        const db = getDB(env);
        const isNsfwMode = context.cookies.get('babylon_is_nsfw')?.value === 'true';

        const allSeries = await db
          .select({ id: series.id, title: series.title })
          .from(series)
          .where(isNsfwMode ? undefined : eq(series.isNsfw, false))
          .orderBy(asc(series.title))
          .all();
        return { success: true, series: allSeries };
      } catch (e) {
        console.error('[Reports Action Error getSeriesList]:', e);
        return { success: false, error: 'Error fetching series', series: [] };
      }
    },
  }),

  getChaptersList: defineAction({
    input: z.object({
      seriesId: z.number().optional(),
      seriesTitle: z.string().optional(),
    }),
    handler: async (input) => {
      try {
        const db = getDB(env);
        let targetSeriesId = input.seriesId;

        if (!targetSeriesId && input.seriesTitle) {
          const s = await db
            .select({ id: series.id })
            .from(series)
            .where(eq(series.title, input.seriesTitle))
            .get();
          if (s) targetSeriesId = s.id;
        }

        if (!targetSeriesId) {
          return { success: false, error: 'Series not found', chapters: [] };
        }

        const allChapters = await db
          .select({ id: chapters.id, number: chapters.chapterNumber })
          .from(chapters)
          .where(eq(chapters.seriesId, targetSeriesId))
          // No necesitamos asc, Drizzle ya retorna orden natural, o podemos usar order. Depende de si es double.
          // pero asc de string numérico falla. Por ahora traer todos.
          .all();

        // Convert numbers to strings for the frontend combobox
        const formattedChapters = allChapters.map((c) => ({
          id: c.id,
          number: String(c.number),
        }));

        return { success: true, chapters: formattedChapters };
      } catch (e) {
        console.error('[Reports Action Error getChaptersList]:', e);
        return { success: false, error: 'Error fetching chapters', chapters: [] };
      }
    },
  }),

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

      // Si faltan variables críticas, fallamos con gracia (fingiendo éxito para no bloquear al usuario)
      if (!botToken || !chatId) {
        console.warn('[Reports] Telegram env vars missing. Skipping message.');
        return { success: true };
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
        let response: Response;
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
