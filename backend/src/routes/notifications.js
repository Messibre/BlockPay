import express from 'express';
import { getUserNotifications, markAsRead } from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getUserNotifications);
router.put('/:id/read', markAsRead);

export default router;
