import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.JWT_SECRET ?? 'jasahub-dev-secret';
const EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 hari

export interface TokenPayload {
  sub: number;
  role: 'pelanggan' | 'admin';
  exp: number;
}

const toBase64Url = (value: string | Buffer): string =>
  Buffer.from(value).toString('base64url');

export function signToken(payload: { sub: number; role: 'pelanggan' | 'admin' }): string {
  const body = toBase64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS,
    }),
  );
  const signature = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (
      typeof payload.sub !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
