import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ping as pingBlockfrost } from './services/blockfrost.js';

import app from './app.js';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cardano-escrow';

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    const bf = await pingBlockfrost().catch((e) => ({ ok: false, error: e.message }));
    console.log('Blockfrost status:', bf);
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

// Only start a persistent server when not running in serverless environments
if (!process.env.VERCEL) {
  start();
}
