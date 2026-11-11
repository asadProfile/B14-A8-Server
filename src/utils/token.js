import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const signAuthToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      photoURL: user.photoURL || '',
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );

export const verifyAuthToken = (token) => jwt.verify(token, config.jwtSecret);

/**
 * The JWT lives in an HTTPOnly cookie, so client-side JavaScript can never
 * read or exfiltrate it. SameSite=Lax works because the Next.js client proxies
 * /api to this server, keeping every request first-party.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: SEVEN_DAYS_MS,
};

export const setAuthCookie = (res, token) => {
  res.cookie(config.cookieName, token, authCookieOptions);
};

export const clearAuthCookie = (res) => {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
  });
};

export const readAuthToken = (req) => {
  const cookieToken = req.cookies?.[config.cookieName];
  if (cookieToken) return cookieToken;

  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};
