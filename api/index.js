import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectDB } from '../src/db.js';
import { ensureSeeded } from '../src/utils/seed.js';

// The Express app is created once per function instance and reused across
// warm invocations. No `listen()` here: Vercel owns the HTTP server.
const app = createApp();

let ready;

/**
 * Connect (or reuse) the database and make sure the demo data exists.
 * The promise is cached so concurrent requests share one connection attempt.
 */
const bootstrap = () => {
  ready ??= (async () => {
    await connectDB();
    if (config.autoSeed) await ensureSeeded();
  })().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
};

export default async function handler(req, res) {
  try {
    await bootstrap();
  } catch (error) {
    console.error('[server] Vercel bootstrap failed:', error.message);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'The API could not reach its database. Check MONGODB_URI.',
      }),
    );
    return;
  }

  return app(req, res);
}
