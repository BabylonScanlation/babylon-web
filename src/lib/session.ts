import type { APIContext } from 'astro';

export function getSession(context: APIContext): string | undefined {
  // Placeholder for getting session from cookies or other storage
  return context.cookies.get('session')?.value;
}

export function setSession(context: APIContext, sessionValue: string): void {
  // Placeholder for setting session cookie
  context.cookies.set('session', sessionValue, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export function deleteSession(context: APIContext): void {
  context.cookies.delete('session', { path: '/' });
}
