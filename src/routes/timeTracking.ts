import express from 'express';
import {
  checkIn,
  checkOut,
  getCurrentMonthTracking,
  getAllUsersTracking
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
router.get('/current-month', getCurrentMonthTracking);

// Routes admin uniquement
router.get('/all-users', authorizeRole(['admin']), getAllUsersTracking);

export default router;