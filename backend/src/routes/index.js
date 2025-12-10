import express from "express";
import authRoutes from "./auth.js";
import jobRoutes from "./jobs.js";
import contractRoutes from "./contracts.js";
import utilRoutes from "./utils.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/jobs", jobRoutes);
router.use("/contracts", contractRoutes);
router.use("/", utilRoutes);

export default router;
