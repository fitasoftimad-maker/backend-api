import { Request, Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import { IApiResponse } from '../types';

// @desc    Créer une nouvelle tâche
// @route   POST /api/tasks
// @access  Private (Admin only)
export const createTask = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
    try {
        const { userId, title, description, date, deadline } = req.body;

        if (req.user!.role !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
            return;
        }

        const task = await Task.create({
            user: userId,
            title,
            description,
            date,
            deadline,
            createdBy: req.user!._id,
            status: 'en cours'
        });

        res.status(201).json({
            success: true,
            message: 'Tâche créée avec succès',
            data: { task }
        });
    } catch (error: any) {
        console.error('Erreur lors de la création de la tâche:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la création de la tâche'
        });
    }
};

// @desc    Obtenir les tâches d'un utilisateur
// @route   GET /api/tasks/user/:userId
// @access  Private
export const getUserTasks = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
    try {
        const { userId } = req.params;
        const { month, year } = req.query;

        // Un utilisateur ne peut voir que ses propres tâches, sauf s'il est admin
        if (req.user!.role !== 'admin' && req.user!._id.toString() !== userId) {
            res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
            return;
        }

        let query: any = { user: userId };

        if (month && year) {
            const startOfMonth = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
            const endOfMonth = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
            query.date = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const tasks = await Task.find(query).sort({ date: 1 });

        res.json({
            success: true,
            message: 'Tâches récupérées avec succès',
            data: { tasks }
        });
    } catch (error: any) {
        console.error('Erreur lors de la récupération des tâches:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la récupération des tâches'
        });
    }
};

// @desc    Mettre à jour le statut d'une tâche
// @route   PATCH /api/tasks/:taskId/status
// @access  Private
export const updateTaskStatus = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;

        if (!['en cours', 'terminé'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
            return;
        }

        const task = await Task.findById(taskId);

        if (!task) {
            res.status(404).json({
                success: false,
                message: 'Tâche non trouvée'
            });
            return;
        }

        // Seul l'utilisateur assigné ou un admin peut changer le statut
        if (req.user!.role !== 'admin' && req.user!._id.toString() !== task.user.toString()) {
            res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
            return;
        }

        task.status = status;
        await task.save();

        res.json({
            success: true,
            message: `Tâche marquée comme ${status}`,
            data: { task }
        });
    } catch (error: any) {
        console.error('Erreur lors de la mise à jour de la tâche:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la mise à jour de la tâche'
        });
    }
};

// @desc    Supprimer une tâche
// @route   DELETE /api/tasks/:taskId
// @access  Private (Admin only)
export const deleteTask = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
    try {
        const { taskId } = req.params;

        if (req.user!.role !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Accès non autorisé'
            });
            return;
        }

        const task = await Task.findByIdAndDelete(taskId);

        if (!task) {
            res.status(404).json({
                success: false,
                message: 'Tâche non trouvée'
            });
            return;
        }

        res.json({
            success: true,
            message: 'Tâche supprimée avec succès'
        });
    } catch (error: any) {
        console.error('Erreur lors de la suppression de la tâche:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la suppression de la tâche'
        });
    }
};
