import mongoose from 'mongoose';
import app from '../src/app.js';

// Cache the connection across lambda invocations (speeds subsequent requests)
let isConnected = false;

async function ensureDatabaseConnection() {
  if (isConnected) return;
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cardano-escrow';
  try {
    await mongoose.connect(MONGO_URI, { autoIndex: true });
    isConnected = true;
    console.log('Connected to MongoDB (serverless wrapper)');
  } catch (err) {
    console.error('Failed to connect to MongoDB (serverless wrapper)', err);
    throw err;
  }
}

export default async function handler(req, res) {
  try {
    await ensureDatabaseConnection();
    // Let the express app handle the request
    return app(req, res);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}
