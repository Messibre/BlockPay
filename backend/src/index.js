import dotenv from "dotenv";
import mongoose from "mongoose";

import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/cardano-escrow";

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();

