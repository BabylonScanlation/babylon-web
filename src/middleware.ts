import { defineMiddleware } from 'astro:middleware';
import { getDB } from './lib/db';

export const onRequest = defineMiddleware(async (context, next) => {
  const runtime = context.locals.runtime;

  if (runtime?.env?.DB) {
    context.locals.db = getDB(runtime.env);
  }

  context.locals.user = undefined;

  const sessionCookie = context.cookies.get('user_session');

  if (sessionCookie?.value) {
    context.locals.user = {
      uid: sessionCookie.value,
      email: null,
    };
  }

  return next();
});
