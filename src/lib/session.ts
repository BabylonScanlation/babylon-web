import type { APIContext } from 'astro';

export function getSession(context: APIContext): string | undefined {
  return context.cookies.get('user_session')?.value;
}

export function setSession(context: APIContext, sessionValue: string): void {
  const url = new URL(context.request.url);
  const isLocalIp = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.');
  const isProduction = import.meta.env.PROD;

  context.cookies.set('user_session', sessionValue, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: isProduction && !isLocalIp,
    sameSite: 'lax',
  });
}

export function deleteSession(context: APIContext): void {
  context.cookies.delete('user_session', { path: '/' });
}
