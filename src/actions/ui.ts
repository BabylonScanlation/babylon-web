import { defineAction } from 'astro:actions';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { getDB } from '../lib/db-client';
import { clearSessionCache } from '../lib/middlewares/auth';

export const uiActions = {
  toggleNsfw: defineAction({
    handler: async (_, context) => {
      const { user, runtime } = context.locals;

      // Orion: Usamos la cookie como fuente de verdad para el "toggle"
      // ya que el objeto 'user' (JWT) puede estar obsoleto hasta el próximo login.
      const current = context.cookies.get('babylon_nsfw')?.value === 'true';
      const newValue = !current;

      // 1. Persistir en la base de datos si el usuario está logueado
      if (user && runtime?.env?.DB) {
        try {
          const db = getDB(runtime.env);
          await db.update(users).set({ isNsfw: newValue }).where(eq(users.id, user.uid)).run();

          // Orion: CRITICO - Limpiar cache para que el middleware lea el nuevo valor de DB
          clearSessionCache(context);
        } catch (e) {
          console.error('[Action toggleNsfw DB Error]:', e);
        }
      }

      // 2. Actualizar la cookie (para invitados y para feedback inmediato del Layout)
      context.cookies.set('babylon_nsfw', newValue.toString(), {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
        httpOnly: false, // Permitimos que el CSS lo lea
      });

      return { success: true, newValue };
    },
  }),
};
