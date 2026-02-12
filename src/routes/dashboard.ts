import express from 'express';
import { body } from 'express-validator';
import {
  getDashboard,
  createWidget,
  updateWidget,
  deleteWidget,
  updatePositions,
  duplicateWidget,
  getDashboardStats,
  getAllUsers,
  deleteUser,
  getPendingUsers,
  validateUser,
  rejectUser,
  validateOvertime,
  rejectOvertime
} from '../controllers/dashboardController';

import {
  authenticateToken,
  authorizeRole
} from '../middleware/auth';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes principales
router.get('/', getDashboard);

// Routes pour les widgets
router.post('/widgets', [
  body('title').notEmpty().withMessage('Le titre est requis'),
  body('type').isIn(['stats', 'chart', 'notes', 'tasks', 'project_list']).withMessage('Type de widget invalide'),
  body('content').optional(),
  body('color').optional().isHexColor().withMessage('Couleur invalide')
], createWidget);

router.put('/widgets/:id', [
  body('title').optional().notEmpty().withMessage('Le titre ne peut pas être vide'),
  body('type').optional().isIn(['stats', 'chart', 'notes', 'tasks', 'project_list']).withMessage('Type de widget invalide'),
  body('content').optional(),
  body('color').optional().isHexColor().withMessage('Couleur invalide'),
  body('position').optional().isInt({ min: 0 }).withMessage('Position invalide')
], updateWidget);

router.delete('/widgets/:id', deleteWidget);

router.put('/widgets/positions', [
  body('positions').isArray().withMessage('Positions doit être un tableau'),
  body('positions.*.id').notEmpty().withMessage('ID requis pour chaque position'),
  body('positions.*.position').isInt({ min: 0 }).withMessage('Position invalide')
], updatePositions);

router.post('/widgets/:id/duplicate', duplicateWidget);

// Routes admin uniquement
router.get('/stats', authorizeRole(['admin']), getDashboardStats);
router.get('/all-users', authorizeRole(['admin']), getAllUsers);
router.get('/pending-users', authorizeRole(['admin']), getPendingUsers);
router.put('/validate-user/:id', authorizeRole(['admin']), validateUser);
router.delete('/reject-user/:id', authorizeRole(['admin']), rejectUser);
router.delete('/users/:id', authorizeRole(['admin']), deleteUser);
router.put('/validate-overtime/:userId', authorizeRole(['admin']), validateOvertime);
router.put('/reject-overtime/:userId', authorizeRole(['admin']), rejectOvertime);

export default router;