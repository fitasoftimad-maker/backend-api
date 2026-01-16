import { Request, Response } from 'express';
import Dashboard from '../models/Dashboard';
import User from '../models/User';
import TimeTracking from '../models/TimeTracking';
import { IApiResponse } from '../types';

// @desc    Obtenir le tableau de bord de l'utilisateur connecté
// @route   GET /api/dashboard
// @access  Private
export const getDashboard = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const userRole = req.user!.role;

    let widgets = [];
    let stats = {};

    if (userRole === 'admin') {
      // Dashboard Admin : voir tous les utilisateurs et leurs activités
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const adminUsers = await User.countDocuments({ role: 'admin' });

      // Récupérer les utilisateurs récents
      const recentUsers = await User.find()
        .select('firstName lastName email role createdAt lastLogin isActive')
        .sort({ createdAt: -1 })
        .limit(5);

      // Statistiques de pointage du mois en cours
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const timeTrackingStats = await TimeTracking.aggregate([
        { $match: { month: currentMonth, year: currentYear } },
        {
          $group: {
            _id: null,
            totalHours: { $sum: '$totalHoursMonth' },
            totalEntries: { $sum: { $size: '$entries' } }
          }
        }
      ]);

      widgets = await Dashboard.find({ user: userId }).sort({ position: 1 });

      stats = {
        totalUsers,
        activeUsers,
        adminUsers,
        recentUsers,
        timeTracking: timeTrackingStats[0] || { totalHours: 0, totalEntries: 0 }
      };

    } else {
      // Dashboard User : voir son profil, ses projets, et pointage
      widgets = await Dashboard.find({ user: userId }).sort({ position: 1 });

      // Récupérer les informations de l'utilisateur connecté
      const currentUser = await User.findById(userId).select('firstName lastName email cin contractType cinRecto cinVerso role createdAt lastLogin');

      // Statistiques personnelles de pointage
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const userTracking = await TimeTracking.findOne({
        user: userId,
        month: currentMonth,
        year: currentYear
      });

      // Statistiques du mois
      const monthlyStats = userTracking ? {
        totalHours: userTracking.totalHoursMonth,
        entriesCount: userTracking.entries.length,
        presentDays: userTracking.entries.filter(e => e.status === 'present').length,
        absentDays: userTracking.entries.filter(e => e.status === 'absent').length
      } : {
        totalHours: 0,
        entriesCount: 0,
        presentDays: 0,
        absentDays: 0
      };

      stats = {
        currentUser,
        monthlyStats,
        todayCheckIn: null, // Sera géré côté frontend
        todayCheckOut: null
      };
    }

    res.json({
      success: true,
      message: 'Tableau de bord récupéré',
      data: {
        widgets,
        stats,
        role: userRole
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du tableau de bord'
    });
  }
};

// @desc    Créer un nouveau widget
// @route   POST /api/dashboard/widgets
// @access  Private
export const createWidget = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { title, type, content, color } = req.body;
    const userId = req.user!._id;

    // Trouver la position maximale actuelle
    const maxPosition = await Dashboard.find({ user: userId }).sort({ position: -1 }).limit(1);
    const position = maxPosition.length > 0 ? maxPosition[0].position + 1 : 0;

    const widget = await Dashboard.create({
      title,
      type,
      content,
      color,
      position,
      user: userId
    });

    res.status(201).json({
      success: true,
      message: 'Widget créé avec succès',
      data: { widget }
    });
  } catch (error) {
    console.error('Erreur lors de la création du widget:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du widget'
    });
  }
};

// @desc    Mettre à jour un widget
// @route   PUT /api/dashboard/widgets/:id
// @access  Private
export const updateWidget = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user!._id;

    const widget = await Dashboard.findOneAndUpdate(
      { _id: id, user: userId },
      updates,
      { new: true }
    );

    if (!widget) {
      res.status(404).json({
        success: false,
        message: 'Widget non trouvé'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Widget mis à jour avec succès',
      data: { widget }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du widget:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du widget'
    });
  }
};

// @desc    Supprimer un widget
// @route   DELETE /api/dashboard/widgets/:id
// @access  Private
export const deleteWidget = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const widget = await Dashboard.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!widget) {
      res.status(404).json({
        success: false,
        message: 'Widget non trouvé'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Widget supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du widget:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du widget'
    });
  }
};

// @desc    Mettre à jour les positions des widgets
// @route   PUT /api/dashboard/widgets/positions
// @access  Private
export const updatePositions = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { positions } = req.body; // Array de { id, position }
    const userId = req.user!._id;

    const updatePromises = positions.map(({ id, position }: { id: string, position: number }) =>
      Dashboard.findOneAndUpdate(
        { _id: id, user: userId },
        { position },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Positions mises à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des positions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des positions'
    });
  }
};

// @desc    Dupliquer un widget
// @route   POST /api/dashboard/widgets/:id/duplicate
// @access  Private
export const duplicateWidget = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const originalWidget = await Dashboard.findOne({ _id: id, user: userId });

    if (!originalWidget) {
      res.status(404).json({
        success: false,
        message: 'Widget non trouvé'
      });
      return;
    }

    // Trouver la position maximale actuelle
    const maxPosition = await Dashboard.find({ user: userId }).sort({ position: -1 }).limit(1);
    const position = maxPosition.length > 0 ? maxPosition[0].position + 1 : 0;

    const duplicatedWidget = await Dashboard.create({
      title: `${originalWidget.title} (Copie)`,
      type: originalWidget.type,
      content: originalWidget.content,
      color: originalWidget.color,
      position,
      user: userId
    });

    res.status(201).json({
      success: true,
      message: 'Widget dupliqué avec succès',
      data: { widget: duplicatedWidget }
    });
  } catch (error) {
    console.error('Erreur lors de la duplication du widget:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la duplication du widget'
    });
  }
};

// @desc    Obtenir les statistiques du dashboard (Admin only)
// @route   GET /api/dashboard/stats
// @access  Private (Admin only)
export const getDashboardStats = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
      return;
    }

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const regularUsers = await User.countDocuments({ role: 'user' });

    // Statistiques de pointage du mois en cours
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const timeTrackingStats = await TimeTracking.aggregate([
      { $match: { month: currentMonth, year: currentYear } },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHoursMonth' },
          totalEntries: { $sum: { $size: '$entries' } },
          avgHoursPerUser: { $avg: '$totalHoursMonth' }
        }
      }
    ]);

    const monthlyStats = timeTrackingStats[0] || {
      totalHours: 0,
      totalEntries: 0,
      avgHoursPerUser: 0
    };

    res.json({
      success: true,
      message: 'Statistiques récupérées',
      data: {
        userStats: {
          totalUsers,
          activeUsers,
          adminUsers,
          regularUsers
        },
        timeTrackingStats: monthlyStats,
        period: {
          month: currentMonth,
          year: currentYear
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};