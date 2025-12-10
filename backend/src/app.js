import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";

import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    origin: process.env.CLIENT_ORIGINS?.split(",") || "*",
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));

app.get("/api/v1/health", async (_req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.use("/api/v1", router);

app.use(errorHandler);

export default app;

