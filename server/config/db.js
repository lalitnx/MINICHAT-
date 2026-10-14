/**
 * config/db.js — MongoDB connection helper
 *
 * WHY a separate file: Keeps database logic out of server.js so the entry
 * point stays small and readable. Also lets us add reconnection logic or
 * connection-event listeners in one place.
 *
 * HOW: Mongoose manages a connection pool internally (default 5 connections).
 * We call `mongoose.connect()` once at startup — after that, every
 * `mongoose.model(...)` call reuses the same pool automatically.
 *
 * DNS FIX: On some Windows machines, Node.js can't resolve MongoDB Atlas
 * SRV records using the default system DNS. We switch to Google's public
 * DNS (8.8.8.8) which reliably resolves SRV records.
 */

const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./index');

// WORKAROUND: Force Google DNS for reliable SRV record resolution
// This fixes "querySrv ECONNREFUSED" errors on Windows
dns.setServers(['8.8.8.8', '8.8.4.4']);

let mongoMemoryServer = null;

const startMemoryServer = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongoMemoryServer = await MongoMemoryServer.create();
  const uri = mongoMemoryServer.getUri();
  await mongoose.connect(uri);
  console.log(`✅ Using local in-memory MongoDB: ${uri}`);
  console.log(`💡 To switch to MongoDB Atlas later, set USE_MEMORY_DB=false in server/.env`);
};

const connectDB = async () => {
  // Option 1: Direct in-memory request for instant local dev
  if (process.env.USE_MEMORY_DB === 'true') {
    try {
      await startMemoryServer();
      return;
    } catch (memErr) {
      console.error(`❌ In-memory MongoDB error: ${memErr.message}`);
      process.exit(1);
    }
  }

  // Option 2: Try remote/Atlas connection with fallback
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ Could not connect to remote MongoDB Atlas: ${error.message}`);
    console.log(`⚡ Falling back to local in-memory MongoDB so you can run the app immediately...`);
    try {
      await startMemoryServer();
    } catch (fallbackError) {
      console.error(`❌ Failed to start in-memory fallback: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};

// Gracefully close in-memory instance on shutdown
const cleanup = async () => {
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = connectDB;

