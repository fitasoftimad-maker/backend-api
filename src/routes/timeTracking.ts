import express from 'express';
import {
  checkIn,
  checkOut,
  startPause,
  resumeWork,
  continueWork,
  getRealTimeStatus,
  getHistory,
  getCurrentMonthTracking,
  getAllUsersTracking,
  getUserHistory
} from '../controllers/timeTrackingController';

import {
  authenticateToken,
  authorizeRole
} from '../middleware/auth';

const router = express.Router();

// Routes pour tous les utilisateurs authentifiés
router.use(authenticateToken);

router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.post('/pause', startPause);
router.post('/resume', resumeWork);
router.post('/continue', continueWork);
router.get('/realtime-status', getRealTimeStatus);
router.get('/history', getHistory);
router.get('/current-month', getCurrentMonthTracking);

// Routes admin uniquement
router.get('/all-users', authorizeRole(['admin']), getAllUsersTracking);
router.get('/user-history/:userId', authorizeRole(['admin']), getUserHistory);

export default router;