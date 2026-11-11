import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer = null;

/**
 * Connects to MongoDB. In development, when MONGODB_URI is not provided, an
 * in-memory MongoDB instance is started so the project runs with zero setup.
 * Production always requires a real connection string.
 */
export const connectDB = async (uri = config.mongoUri) => {
  let mongoUri = uri;

  if (!mongoUri) {
    if (config.isProd) {
      throw new Error('MONGODB_URI is required in production.');
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    mongoUri = memoryServer.getUri('studiosspace');
    console.log('[db] MONGODB_URI not set — using in-memory MongoDB for development.');
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
