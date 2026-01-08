import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { IApiResponse } from '../types';

// Étendre l'interface Request pour inclure l'utilisateur
declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: string;
        email: string;
      };
    }
  }
}

// Middleware d'authentification JWT
export const authenticateToken = async (req: Request, res: Response<IApiResponse>, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant'
      });
      return;
    }

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string; email: string };

    // Vérifier si l'utilisateur existe toujours
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
      return;
    }

    // Attacher l'utilisateur à la requête
    req.user = {
      _id: user._id.toString(),
      role: user.role,
      email: user.email
    };

    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(403).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

// Middleware d'autorisation par rôle
export const authorizeRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response<IApiResponse>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé - Rôle insuffisant'
      });
      return;
    }

    next();
  };
};

// Middleware de limitation du taux de connexion
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max par fenêtre
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de validation de la force du mot de passe
export const validatePasswordStrength = (req: Request, res: Response, next: NextFunction): void => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({
      success: false,
      message: 'Mot de passe requis'
    });
    return;
  }

  // Vérifications de sécurité du mot de passe
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    res.status(400).json({
      success: false,
      message: `Le mot de passe doit contenir au moins ${minLength} caractères`
    });
    return;
  }

  // Validation recommandée mais pas obligatoire pour l'instant
  // if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
  //   res.status(400).json({
  //     success: false,
  //     message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
  //   });
  //   return;
  // }

  next();
};