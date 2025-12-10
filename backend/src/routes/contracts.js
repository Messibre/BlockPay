import express from 'express';
import * as contractController from '../controllers/contractController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, contractController.createContract);
router.get('/:id', authenticate, contractController.getContract);
router.post('/:id/deposit', authenticate, contractController.recordDeposit);
router.get('/:id/deposits', authenticate, contractController.getDeposits);
router.get('/', authenticate, contractController.getMyContracts);

export default router;
