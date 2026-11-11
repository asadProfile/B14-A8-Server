import { createApp } from './app.js';
import { config } from './config.js';
import { connectDB, disconnectDB } from './db.js';
import { ensureSeeded } from './utils/seed.js';

const start = async () => {
  await connectDB();

  if (config.autoSeed) {
    await ensureSeeded();
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`StudioSpace API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — closing gracefully.`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
