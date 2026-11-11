import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRouter from './routes/auth.js';
import studiosRouter from './routes/studios.js';
import bookingsRouter from './routes/bookings.js';
import wishlistRouter from './routes/wishlist.js';
import uploadRouter from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const isAllowedOrigin = (origin) => {
    if (!origin) return true; // curl, server-to-server, same-origin proxies
    if (config.clientUrls.includes(origin)) return true;
    if (!config.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
    return false;
  };

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS.'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!config.isTest) {
    app.use(morgan(config.isProd ? 'combined' : 'dev'));
  }

  // Uploaded images (fallback when ImgBB is not configured).
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '..', 'uploads'), {
      maxAge: '7d',
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      success: true,
      service: 'StudioSpace API',
      status: 'ok',
      database: states[mongoose.connection.readyState] ?? 'unknown',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      name: 'StudioSpace API',
      version: '1.0.0',
      docs: 'See README.md for the full route reference.',
      health: '/api/health',
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/studios', studiosRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/upload', uploadRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
