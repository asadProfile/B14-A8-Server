import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

const clientUrls = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const config = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrls,
  jwtSecret: process.env.JWT_SECRET || 'studiosspace-development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'studiosspace_token',
  mongoUri: process.env.MONGODB_URI || '',
  autoSeed: process.env.AUTO_SEED !== 'false',
  imgbbKey: process.env.IMGBB_API_KEY || '',
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    get enabled() {
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    },
  },
};

if (isProd && config.jwtSecret.startsWith('studiosspace-development')) {
  throw new Error('JWT_SECRET must be set to a strong value in production.');
}
