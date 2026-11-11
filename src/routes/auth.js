import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';

import { config } from '../config.js';
import { User } from '../models/User.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearAuthCookie, setAuthCookie, signAuthToken } from '../utils/token.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
});

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters.')
  .max(72, 'Password must be 72 characters or fewer.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  photoURL: z
    .union([z.string().trim().url('Photo URL must be a valid link.'), z.literal('')])
    .optional()
    .default(''),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  photoURL: user.photoURL || '',
  provider: user.provider,
  createdAt: user.createdAt,
});

const safeInternalPath = (value, fallback = '/') => {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
};

/* ------------------------------------------------------------------ */
/* Email + password                                                    */
/* ------------------------------------------------------------------ */

router.post(
  '/register',
  authLimiter,
  validate('body', registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, photoURL, password } = req.body;

    const existing = await User.exists({ email });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists. Try signing in instead.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, photoURL, passwordHash });

    res.status(201).json({
      success: true,
      message: 'Your account is ready. Sign in to start creating.',
      user: publicUser(user),
    });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate('body', loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    const isMatch = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !isMatch) {
      throw new ApiError(401, 'Email or password is incorrect.');
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    res.json({ success: true, message: `Welcome back, ${user.name.split(' ')[0]}.`, user: publicUser(user) });
  }),
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'You have been signed out.' });
});

router.get(
  '/me',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, user: req.user ? publicUser(req.user) : null });
  }),
);

router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, user: publicUser(req.user) });
  }),
);

/* ------------------------------------------------------------------ */
/* Google OAuth (authorization-code flow, configured via env)          */
/* ------------------------------------------------------------------ */

const oauthStateCookie = 'studiosspace_oauth_state';

const googleClient = () =>
  new OAuth2Client({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
  });

const apiOrigin = (req) =>
  config.publicApiUrl || `${req.protocol}://${req.get('host')}`;

const redirectWithError = (res, origin, code) =>
  res.redirect(`${origin}/login?error=${encodeURIComponent(code)}`);

router.get('/google', (req, res) => {
  const clientOrigin = config.clientUrls[0] || 'http://localhost:3000';

  if (!config.google.enabled) {
    return redirectWithError(res, clientOrigin, 'google_not_configured');
  }

  const redirectPath = safeInternalPath(req.query.redirect, '/');
  const state = jwt.sign(
    { redirect: redirectPath, nonce: Math.random().toString(36).slice(2) },
    config.jwtSecret,
    { expiresIn: '10m' },
  );

  res.cookie(oauthStateCookie, state, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: `${apiOrigin(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const clientOrigin = config.clientUrls[0] || 'http://localhost:3000';
    const { code, state } = req.query;
    const cookieState = req.cookies?.[oauthStateCookie];

    res.clearCookie(oauthStateCookie, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      path: '/',
    });

    if (!config.google.enabled) {
      return redirectWithError(res, clientOrigin, 'google_not_configured');
    }
    if (!code || !state || !cookieState || state !== cookieState) {
      return redirectWithError(res, clientOrigin, 'google_state_mismatch');
    }

    let redirectPath = '/';
    try {
      const decoded = jwt.verify(state, config.jwtSecret);
      redirectPath = safeInternalPath(decoded.redirect, '/');
    } catch {
      return redirectWithError(res, clientOrigin, 'google_state_expired');
    }

    try {
      const client = googleClient();
      const { tokens } = await client.getToken({
        code,
        redirect_uri: `${apiOrigin(req)}/api/auth/google/callback`,
      });
      if (!tokens.id_token) throw new Error('Google did not return an ID token.');

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.google.clientId,
      });
      const profile = ticket.getPayload();
      if (!profile?.email || !profile.email_verified) {
        throw new Error('A verified Google email is required.');
      }

      const email = profile.email.toLowerCase();
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: profile.name || email.split('@')[0],
          email,
          photoURL: profile.picture || '',
          provider: 'google',
        });
      } else if (profile.picture && !user.photoURL) {
        user.photoURL = profile.picture;
        await user.save();
      }

      const token = signAuthToken(user);
      setAuthCookie(res, token);
      return res.redirect(`${clientOrigin}${redirectPath}`);
    } catch (error) {
      console.error('[auth:google]', error.message);
      return redirectWithError(res, clientOrigin, 'google_failed');
    }
  }),
);

export default router;
