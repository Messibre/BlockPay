import express from 'express';
import authRoutes from './auth.js';
import jobRoutes from './jobs.js';
import contractRoutes from './contracts.js';
import proposalRoutes from './proposals.js';
import utilRoutes from './utils.js';
import { authenticate } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/jobs', jobRoutes);
router.use('/contracts', contractRoutes);
router.use('/proposals', proposalRoutes);
router.use('/', utilRoutes);

// Dashboard Routes
router.get('/dashboard/stats', authenticate, getDashboardStats);

export default router;
