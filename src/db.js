import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer = null;

/**
 * Connects to MongoDB. In development, when MONGODB_URI is not provided, an
 * in-memory MongoDB instance is started so the project runs with zero setup.
 * Production requires a real connection string unless the deployment opts in
 * to ALLOW_IN_MEMORY_DB, which is only safe for a single-instance demo host:
 * every serverless instance would otherwise get its own unrelated database.
 */
export const connectDB = async (uri = config.mongoUri) => {
  let mongoUri = uri;

  if (!mongoUri) {
    if (config.isProd && !config.allowInMemoryDb) {
      throw new Error('MONGODB_URI is required in production.');
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    mongoUri = memoryServer.getUri('studiosspace');
    console.log(
      config.isProd
        ? '[db] ALLOW_IN_MEMORY_DB is on — data will reset when this service restarts.'
        : '[db] MONGODB_URI not set — using in-memory MongoDB for development.',
    );
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15_000 });
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name}).`);
  return mongoose.connection;
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};
