import { createHmac, timingSafeEqual } from 'node:crypto';
export const PRICE = 34700;
export const TITLE = '[OFERTA OFICIAL] Black Saúde 360 - Dra. Ryuza Gonçalves';
export const API = 'https://api.blackcatoficial.com/api';
export function signToken(id, key) {
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() + 2 * 86400000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}
export function readToken(token, key) {
  if (typeof token !== 'string' || token.length > 2000) throw new Error('Invalid token');
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', key).update(payload).digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid token');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (typeof data.id !== 'string' || !Number.isFinite(data.exp) || data.exp <= Date.now()) throw new Error('Expired token');
  return data.id;
}
export function reply(res, code, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(body);
}
