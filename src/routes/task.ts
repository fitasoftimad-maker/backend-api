import express from 'express';
import { createTask, getUserTasks, updateTaskStatus, deleteTask } from '../controllers/taskController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Toutes les routes sont protégées (nécessitent d'être connecté)
router.use(authenticateToken);

router.post('/', createTask);
router.get('/user/:userId', getUserTasks);
router.patch('/:taskId/status', updateTaskStatus);
router.delete('/:taskId', deleteTask);

export default router;
