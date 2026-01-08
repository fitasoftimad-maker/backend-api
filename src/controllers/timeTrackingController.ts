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
    await TimeTracking.createOrUpdateEntry(new Types.ObjectId(userId), {
      date: new Date(),
      checkOut: now
    });

    res.json({
      success: true,
      message: 'Pointage départ enregistré',
      data: {
        checkOut: now
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