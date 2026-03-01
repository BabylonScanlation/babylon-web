import { defineAction } from 'astro:actions';

export const uiActions = {
  toggleNsfw: defineAction({
    handler: async (_, context) => {
      const current = context.cookies.get('babylon_nsfw')?.value === 'true';
      const newValue = !current;

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
