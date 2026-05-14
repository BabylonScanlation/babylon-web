import { defineMiddleware } from 'astro:middleware';

export const compatibility = defineMiddleware(async (_context, next) => {
  return next();
});
