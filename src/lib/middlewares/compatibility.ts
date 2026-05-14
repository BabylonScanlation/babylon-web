import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

export const compatibility = defineMiddleware(async (context, next) => {
  if (context.locals.runtime) {
    // Restore Astro 5 behavior in Astro 6
    context.locals.runtime.env = env;
    if (!context.locals.runtime.ctx) {
      context.locals.runtime.ctx = context.locals.runtime;
    }
  }
  return next();
});
