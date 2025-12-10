import express from "express";
import * as jobController from "../controllers/jobController.js";
import { authenticate, requireClient } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, requireClient, jobController.createJob);
router.get("/", jobController.getJobs);
router.get("/:id", jobController.getJobById);

export default router;

