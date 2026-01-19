import { Request, Response } from 'express';
import { Types } from 'mongoose';
import TimeTracking from '../models/TimeTracking';
import { IApiResponse } from '../types';

// @desc    Pointer l'arrivée
// @route   POST /api/timetracking/checkin
// @access  Private (User only)
export const checkIn = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const now = new Date();

    const tracking = await TimeTracking.createOrUpdateEntry(new Types.ObjectId(userId), {
      date: now,
      checkIn: now,
      status: 'present'
    });

    res.json({
      success: true,
      message: 'Pointage arrivée enregistré',
      data: {
        checkIn: now,
        tracking
      }
    });
  } catch (error) {
    console.error('Erreur lors du pointage arrivée:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du pointage arrivée'
    });
  }
};

// @desc    Pointer le départ
// @route   POST /api/timetracking/checkout
// @access  Private (User only)
export const checkOut = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const now = new Date();

    // Récupérer le suivi du jour
    const tracking = await TimeTracking.getCurrentMonthTracking(new Types.ObjectId(userId));

    if (!tracking) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui'
      });
      return;
    }

    // Trouver l'entrée d'aujourd'hui
    const today = new Date().toDateString();
    const todayEntry = tracking.entries.find(
      entry => entry.date.toDateString() === today
    );

    if (!todayEntry || !todayEntry.checkIn) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage d\'arrivée trouvé pour aujourd\'hui'
      });
      return;
    }

    // Mettre à jour avec l'heure de départ
    const updatedTracking = await TimeTracking.createOrUpdateEntry(new Types.ObjectId(userId), {
      date: new Date(),
      checkOut: now
    });

    // Récupérer l'entrée mise à jour pour obtenir les heures nettes calculées
    const updatedToday = new Date().toDateString();
    const updatedEntry = updatedTracking.entries.find(
      entry => entry.date.toDateString() === updatedToday
    );

    const netHours = updatedEntry?.netHours || 0;
    const hasReachedEightHours = netHours >= 8;

    res.json({
      success: true,
      message: hasReachedEightHours 
        ? 'Pointage départ enregistré. Vous avez atteint 8 heures de travail !' 
        : 'Pointage départ enregistré',
      data: {
        checkOut: now,
        netHours: netHours,
        hasReachedEightHours: hasReachedEightHours
      }
    });
  } catch (error) {
    console.error('Erreur lors du pointage départ:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du pointage départ'
    });
  }
};

// @desc    Démarrer une pause
// @route   POST /api/timetracking/pause
// @access  Private (User only)
export const startPause = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const now = new Date();

    const tracking = await TimeTracking.getCurrentMonthTracking(new Types.ObjectId(userId));

    if (!tracking) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage trouvé pour aujourd\'hui'
      });
      return;
    }

    const today = new Date().toDateString();
    const todayEntry = tracking.entries.find(
      entry => entry.date.toDateString() === today
    );

    if (!todayEntry || !todayEntry.checkIn || todayEntry.checkOut) {
      res.status(400).json({
        success: false,
        message: 'Vous devez être en cours de travail pour faire une pause'
      });
      return;
    }

    // Démarrer une nouvelle pause
    todayEntry.breaks.push({ start: now });
    todayEntry.isPaused = true;

    await tracking.save();

    res.json({
      success: true,
      message: 'Pause démarrée',
      data: {
        pauseStart: now,
        entry: todayEntry
      }
    });
  } catch (error) {
    console.error('Erreur lors du démarrage de pause:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage de pause'
    });
  }
};

// @desc    Arrêter une pause (reprendre le travail)
// @route   POST /api/timetracking/resume
// @access  Private (User only)
export const resumeWork = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const now = new Date();

    const tracking = await TimeTracking.getCurrentMonthTracking(new Types.ObjectId(userId));

    if (!tracking) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage trouvé'
      });
      return;
    }

    const today = new Date().toDateString();
    const todayEntry = tracking.entries.find(
      entry => entry.date.toDateString() === today
    );

    if (!todayEntry || !todayEntry.checkIn) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage d\'arrivée trouvé'
      });
      return;
    }

    // Trouver la dernière pause non terminée
    const lastBreak = todayEntry.breaks[todayEntry.breaks.length - 1];
    if (!lastBreak || lastBreak.end) {
      res.status(400).json({
        success: false,
        message: 'Aucune pause en cours'
      });
      return;
    }

    // Terminer la pause
    lastBreak.end = now;
    lastBreak.duration = (now.getTime() - lastBreak.start.getTime()) / (1000 * 60); // durée en minutes
    todayEntry.isPaused = false;
    todayEntry.lastResumeTime = now;

    await tracking.save();

    res.json({
      success: true,
      message: 'Travail repris',
      data: {
        resumeTime: now,
        breakDuration: lastBreak.duration,
        entry: todayEntry
      }
    });
  } catch (error) {
    console.error('Erreur lors de la reprise du travail:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reprise du travail'
    });
  }
};

// @desc    Reprendre le travail après un départ pour compléter 8h
// @route   POST /api/timetracking/continue
// @access  Private (User only)
export const continueWork = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const now = new Date();

    const tracking = await TimeTracking.getCurrentMonthTracking(new Types.ObjectId(userId));

    if (!tracking) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage trouvé'
      });
      return;
    }

    const today = new Date().toDateString();
    const todayEntry = tracking.entries.find(
      entry => entry.date.toDateString() === today
    );

    if (!todayEntry || !todayEntry.checkIn) {
      res.status(400).json({
        success: false,
        message: 'Aucun pointage d\'arrivée trouvé'
      });
      return;
    }

    if (!todayEntry.checkOut) {
      res.status(400).json({
        success: false,
        message: 'La journée est déjà en cours, inutile de reprendre'
      });
      return;
    }

    // Enregistrer la période entre l'ancien départ et maintenant comme une grande pause
    const previousCheckOut = todayEntry.checkOut;
    const breakDurationMinutes = (now.getTime() - previousCheckOut.getTime()) / (1000 * 60);

    todayEntry.breaks.push({
      start: previousCheckOut,
      end: now,
      duration: breakDurationMinutes
    });

    // Réouvrir la journée : on supprime le départ et on indique que le travail reprend
    todayEntry.checkOut = undefined;
    todayEntry.isPaused = false;
    todayEntry.lastResumeTime = now;

    // Recalculer les heures pour l'entrée
    if (typeof (TimeTracking as any).calculateEntryHours === 'function') {
      (TimeTracking as any).calculateEntryHours(todayEntry);
    }

    await tracking.save();

    res.json({
      success: true,
      message: 'Travail repris pour compléter les 8h',
      data: {
        resumeTime: now,
        entry: todayEntry
      }
    });
  } catch (error) {
    console.error('Erreur lors de la reprise du travail après départ:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la reprise du travail après départ'
    });
  }
};

// @desc    Obtenir le status temps réel du pointage
// @route   GET /api/timetracking/realtime-status
// @access  Private
export const getRealTimeStatus = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const status = await TimeTracking.getTodayRealTimeStatus(new Types.ObjectId(userId));

    res.json({
      success: true,
      message: 'Status temps réel récupéré',
      data: {
        status
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du status temps réel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du status temps réel'
    });
  }
};

// @desc    Obtenir l'historique détaillé avec calendrier
// @route   GET /api/timetracking/history
// @access  Private
export const getHistory = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { month, year } = req.query;

    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const tracking = await TimeTracking.findOne({
      user: userId,
      month: targetMonth,
      year: targetYear
    });

    // Calculer les totaux semaine par semaine
    const weeklyTotals = [];
    if (tracking) {
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      for (let week = 0; week < 5; week++) {
        const weekStart = new Date(targetYear, targetMonth - 1, week * 7 + 1);
        const weekEnd = new Date(targetYear, targetMonth - 1, Math.min((week + 1) * 7, daysInMonth));

        const weekEntries = tracking.entries.filter(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= weekStart && entryDate <= weekEnd;
        });

        const weekTotal = weekEntries.reduce((total, entry) => total + (entry.netHours || 0), 0);

        weeklyTotals.push({
          week: week + 1,
          startDate: weekStart,
          endDate: weekEnd,
          totalHours: weekTotal,
          entries: weekEntries.length
        });
      }
    }

    res.json({
      success: true,
      message: 'Historique récupéré',
      data: {
        tracking: tracking || {
          entries: [],
          totalHoursMonth: 0,
          month: targetMonth,
          year: targetYear
        },
        weeklyTotals,
        month: targetMonth,
        year: targetYear
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

// @desc    Obtenir le suivi du mois en cours
// @route   GET /api/timetracking/current-month
// @access  Private
export const getCurrentMonthTracking = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const userId = req.user!._id;
    const tracking = await TimeTracking.getCurrentMonthTracking(new Types.ObjectId(userId));

    res.json({
      success: true,
      message: 'Suivi du mois récupéré',
      data: {
        tracking: tracking || {
          entries: [],
          totalHoursMonth: 0,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du suivi:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du suivi'
    });
  }
};

// @desc    Obtenir l'historique d'un utilisateur spécifique (Admin only)
// @route   GET /api/timetracking/user-history/:userId
// @access  Private (Admin only)
export const getUserHistory = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
      return;
    }

    const { userId } = req.params;
    const { month, year } = req.query;

    const targetMonth = parseInt(month as string) || new Date().getMonth() + 1;
    const targetYear = parseInt(year as string) || new Date().getFullYear();

    const tracking = await TimeTracking.findOne({
      user: userId,
      month: targetMonth,
      year: targetYear
    });

    const entries = tracking ? tracking.entries : [];

    res.json({
      success: true,
      message: 'Historique utilisateur récupéré',
      data: {
        tracking: {
          entries,
          totalHoursMonth: tracking?.totalHoursMonth || 0,
          month: targetMonth,
          year: targetYear
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique utilisateur'
    });
  }
};

// @desc    Obtenir le suivi de tous les utilisateurs (Admin only)
// @route   GET /api/timetracking/all-users
// @access  Private (Admin only)
export const getAllUsersTracking = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const allTracking = await TimeTracking.find({
      month: currentMonth,
      year: currentYear
    }).populate('user', 'firstName lastName email username role');

    res.json({
      success: true,
      message: 'Suivi de tous les utilisateurs récupéré',
      data: {
        tracking: allTracking,
        month: currentMonth,
        year: currentYear
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du suivi de tous les utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du suivi'
    });
  }
};