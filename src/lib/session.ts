import type { APIContext } from 'astro';
import { SignJWT, jwtVerify } from 'jose';

export interface UserSessionPayload {
  uid: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: string;
  isNsfw: boolean;
}

export async function createToken(payload: UserSessionPayload, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret.trim().replace(/\n'$/, ''));
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<UserSessionPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret.trim().replace(/\n'$/, ''));
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}

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

export async function setAuthCookie(context: APIContext, payload: UserSessionPayload, secret: string): Promise<void> {
  const token = await createToken(payload, secret);
  const url = new URL(context.request.url);
  const isLocalIp = url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.');
  const isProduction = import.meta.env.PROD;

  context.cookies.set('user_auth', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: isProduction && !isLocalIp,
    sameSite: 'lax',
  });
}

export function deleteSession(context: APIContext): void {
  context.cookies.delete('user_session', { path: '/' });
  context.cookies.delete('user_auth', { path: '/' });
  context.cookies.delete('user_role', { path: '/' });
}
