import { MongoClient } from 'mongodb';
import { VIJETHA_DATABASE_NAME } from './database-config.js';

const runtimeKey = Symbol.for('vijetha.mongo.runtime');
const runtime = globalThis[runtimeKey] || {
  client: null,
  database: null,
  connection: null,
};
globalThis[runtimeKey] = runtime;

export async function getVijethaDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (runtime.database) return runtime.database;
  if (!runtime.connection) {
    runtime.client = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 8,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      waitQueueTimeoutMS: 5_000,
      serverSelectionTimeoutMS: 7_000,
      connectTimeoutMS: 7_000,
      socketTimeoutMS: 20_000,
      retryReads: true,
      retryWrites: true,
    });
    runtime.connection = runtime.client.connect()
      .then(() => {
        runtime.database = runtime.client.db(VIJETHA_DATABASE_NAME);
        return runtime.database;
      })
      .catch((error) => {
        runtime.connection = null;
        runtime.database = null;
        runtime.client = null;
        throw error;
      });
  }
  return runtime.connection;
}

export function hasVijethaDatabaseConfiguration() {
  return Boolean(process.env.MONGODB_URI);
}
