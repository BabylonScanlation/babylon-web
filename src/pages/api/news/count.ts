import { env } from 'cloudflare:workers';
// src/pages/api/news/count.ts
import type { APIRoute } from 'astro';
import { and, count, eq, gt } from 'drizzle-orm';
import { news, users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals, cookies }) => {
  const drizzleDb = locals.db || getDB(env);
  const user = locals.user;

  try {
    let lastSeenId: string | null = null;

    if (user) {
      // Prioridad 1: Si hay usuario, mandar lo que diga su perfil
      try {
        let prefs = user.preferences;

        // Si no vienen en el locals (JWT Fast Path), buscamos en DB
        if (!prefs) {
          const dbUser = await drizzleDb
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, user.uid))
            .get();
          prefs = dbUser?.preferences ?? undefined;
        }

        const parsedPrefs = typeof prefs === 'string' ? JSON.parse(prefs) : prefs || {};
        lastSeenId = parsedPrefs?.lastSeenNewsId || null;
      } catch (e) {
        console.error('[API News Count Prefs Error]:', e);
        lastSeenId = null;
      }
    } else {
      // Prioridad 2: Si es invitado, mandar la cookie
      lastSeenId = cookies.get('last_news_id')?.value || null;
    }

    // Orion: Limpieza de valores nulos/undefined en string
    if (lastSeenId === 'undefined' || lastSeenId === 'null' || !lastSeenId) {
      lastSeenId = null;
    }

    // Caso 1: Usuario Invitado o sin historial (Devolver total)
    if (!lastSeenId) {
      const result = await drizzleDb
        .select({ total: count() })
        .from(news)
        .where(eq(news.status, 'published'))
        .get();

      return new Response(JSON.stringify({ count: result?.total ?? 0 }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'cf-edge-cache': 'no-cache',
        },
      });
    }

    // Caso 2: Calcular diferencial respecto al último visto
    const lastSeenNews = await drizzleDb
      .select({ createdAt: news.createdAt })
      .from(news)
      .where(eq(news.id, String(lastSeenId)))
      .get();

    let unreadCount = 0;
    if (!lastSeenNews) {
      // El ID guardado ya no existe → fallback al conteo total
      const result = await drizzleDb
        .select({ total: count() })
        .from(news)
        .where(eq(news.status, 'published'))
        .get();
      unreadCount = result?.total ?? 0;
    } else {
      // Contamos las noticias publicadas posteriores a la última vista.
      // Esto escala sin importar cuántas noticias existan (antes el tope de 50 lo rompía).
      const unreadResult = await drizzleDb
        .select({ total: count() })
        .from(news)
        .where(and(eq(news.status, 'published'), gt(news.createdAt, lastSeenNews.createdAt)))
        .get();
      unreadCount = unreadResult?.total ?? 0;
    }

    return new Response(JSON.stringify({ count: unreadCount }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'cf-edge-cache': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API/NewsCount] Error:', error);
    return new Response(JSON.stringify({ count: 0, error: 'Internal Error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
