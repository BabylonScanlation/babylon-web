// src/pages/api/news/count.ts
import type { APIRoute } from 'astro';
import { count, desc, eq, sql } from 'drizzle-orm';
import { news, users } from '../../../db/schema';
import { getDB } from '../../../lib/db';

export const GET: APIRoute = async ({ locals, cookies }) => {
  const drizzleDb = locals.db || getDB(locals.runtime.env);
  const user = locals.user;

  try {
    let lastSeenId: string | null = null;

    if (user) {
      // Prioridad 1: Si hay usuario, mandar lo que diga su perfil
      try {
        let prefs = (user as any).preferences;

        // Si no vienen en el locals (JWT Fast Path), buscamos en DB
        if (!prefs) {
          const dbUser = await drizzleDb
            .select({ preferences: users.preferences })
            .from(users)
            .where(eq(users.id, user.uid))
            .get();
          prefs = dbUser?.preferences;
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
    const latestNews = await drizzleDb
      .select({ id: news.id })
      .from(news)
      .where(eq(news.status, 'published'))
      .orderBy(desc(sql`CAST(${news.createdAt} AS INTEGER)`))
      .limit(50)
      .all();

    let unreadCount = 0;
    if (latestNews && latestNews.length > 0) {
      const lastSeenIdStr = String(lastSeenId).trim();
      const lastSeenIndex = latestNews.findIndex((n) => String(n.id).trim() === lastSeenIdStr);

      if (lastSeenIndex === -1) {
        // Fallback al conteo total
        const result = await drizzleDb
          .select({ total: count() })
          .from(news)
          .where(eq(news.status, 'published'))
          .get();
        unreadCount = result?.total ?? 0;
      } else {
        unreadCount = lastSeenIndex;
      }
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
