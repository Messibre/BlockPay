import express from 'express';
import * as jobController from '../controllers/jobController.js';
import * as proposalController from '../controllers/proposalController.js';
import { authenticate, requireClient, requireFreelancer } from '../middleware/auth.js';

const router = express.Router();

// Job routes
router.post('/', authenticate, requireClient, jobController.createJob);
router.get('/', jobController.getJobs);
router.get('/:id', jobController.getJobById);

// Proposal routes
router.post(
  '/:jobId/proposals',
  authenticate,
  requireFreelancer,
  proposalController.submitProposal,
);
router.get('/:jobId/proposals', authenticate, proposalController.getProposals);
router.get('/proposals/my', authenticate, requireFreelancer, proposalController.getMyProposals);

export default router;
