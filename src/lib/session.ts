import { jwtVerify, SignJWT } from 'jose';
import type { SessionContext } from '../types';

export interface UserSessionPayload {
  uid: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: string;
  isNsfw: boolean;
  tokenVersion: number;
  jti?: string;
}

export async function createToken(payload: UserSessionPayload, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  const jti = crypto.randomUUID();
  return await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<UserSessionPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as UserSessionPayload;
  } catch {
    return null;
  }
}

export function getSession(context: SessionContext): string | undefined {
  return context.cookies.get('user_session')?.value;
}

export function setSession(context: SessionContext, sessionValue: string): void {
  const url = new URL(context.request.url);
  const isLocal =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.');

  context.cookies.set('user_session', sessionValue, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: !isLocal,
    sameSite: 'lax',
  });
}

export async function setAuthCookie(
  context: SessionContext,
  payload: UserSessionPayload,
  secret: string
): Promise<void> {
  const token = await createToken(payload, secret);
  const url = new URL(context.request.url);
  const isLocal =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.startsWith('10.') ||
    url.hostname.startsWith('172.');

  context.cookies.set('user_auth', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: !isLocal,
    sameSite: 'lax',
  });
}

export function deleteSession(context: SessionContext): void {
  context.cookies.delete('user_session', { path: '/' });
  context.cookies.delete('user_auth', { path: '/' });
  context.cookies.delete('user_role', { path: '/' });
}
