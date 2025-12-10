import express from 'express';
import * as proposalController from '../controllers/proposalController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/:proposalId/accept', authenticate, proposalController.acceptProposal);
router.post('/:proposalId/reject', authenticate, proposalController.rejectProposal);

export default router;
