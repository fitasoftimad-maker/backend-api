import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User, { IUserDocument } from '../models/User';
import Dashboard from '../models/Dashboard';
import jwt, { SignOptions } from 'jsonwebtoken';
import { IAuthRequest, ILoginRequest, IUpdateProfileRequest, IChangePasswordRequest, IApiResponse } from '../types';

// Générer un token JWT
const generateToken = (id: string, role: string): string => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, {
    expiresIn: '7d'
  });
};

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request<{}, IApiResponse, IAuthRequest>, res: Response<IApiResponse>): Promise<void> => {
  try {
    console.log('🔍 Requête d\'inscription reçue:', req.body);
    const errors = validationResult(req);
    console.log('🔍 Erreurs de validation:', errors.array());

    if (!errors.isEmpty()) {
      console.log('❌ Erreurs de validation détectées');
      res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
      return;
    }

    const { email, password, firstName, lastName, role } = req.body;

    // Générer automatiquement un username unique basé sur firstName et lastName
    const baseUsername = `${firstName?.toLowerCase().replace(/\s+/g, '') || 'user'}${lastName?.toLowerCase().replace(/\s+/g, '') || ''}`;
    let username = baseUsername;
    let counter = 1;

    // S'assurer que le username est unique
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Vérifier si l'utilisateur existe déjà (par email uniquement)
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
      return;
    }

    // Créer l'utilisateur avec le rôle spécifié
    const user: IUserDocument = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || 'user' // Par défaut user si pas spécifié
    });

    // Créer les widgets par défaut pour le tableau de bord
    await Dashboard.createDefaultWidgets(user._id);

    // Générer le token
    const token = generateToken(user._id.toString(), user.role);

    const response: IApiResponse = {
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar
        },
        token
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription'
    });
  }
};

// @desc    Connexion d'un utilisateur
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request<{}, IApiResponse, ILoginRequest>, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
      return;
    }

    // Trouver l'utilisateur et inclure le mot de passe
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
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

    // Vérifier si le compte est verrouillé
    if (user.isLocked()) {
      res.status(423).json({
        success: false,
        message: 'Compte temporairement verrouillé en raison de trop nombreuses tentatives'
      });
      return;
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Incrémenter les tentatives de connexion
      await user.incLoginAttempts();
      res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
      return;
    }

    // Réinitialiser les tentatives de connexion
    await user.resetLoginAttempts();

    // Générer le token
    const token = generateToken(user._id.toString(), user.role);

    const response: IApiResponse = {
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          lastLogin: user.lastLogin
        },
        token
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
};

// @desc    Obtenir le profil de l'utilisateur connecté
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const user = await User.findById(req.user!._id);

    res.json({
      success: true,
      message: 'Profil utilisateur récupéré',
      data: {
        user: {
          id: user!._id.toString(),
          username: user!.username,
          email: user!.email,
          firstName: user!.firstName,
          lastName: user!.lastName,
          role: user!.role,
          avatar: user!.avatar,
          lastLogin: user!.lastLogin,
          createdAt: user!.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du profil'
    });
  }
};

// @desc    Mettre à jour le profil
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req: Request<{}, IApiResponse, IUpdateProfileRequest>, res: Response<IApiResponse>): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
      return;
    }

    const { username, email, firstName, lastName, avatar } = req.body;

    // Vérifier si le nouveau username/email est déjà pris
    const existingUser = await User.findOne({
      $or: [
        { username, _id: { $ne: req.user!._id } },
        { email, _id: { $ne: req.user!._id } }
      ]
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: existingUser.username === username
          ? 'Ce nom d\'utilisateur est déjà pris'
          : 'Cet email est déjà utilisé'
      });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      { username, email, firstName, lastName, avatar },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: {
          id: updatedUser!._id,
          username: updatedUser!.username,
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          role: updatedUser!.role,
          avatar: updatedUser!.avatar
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du profil'
    });
  }
};

// @desc    Changer le mot de passe
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req: Request<{}, IApiResponse, IChangePasswordRequest>, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
      return;
    }

    const user = await User.findById(req.user!._id).select('+password');

    // Vérifier le mot de passe actuel
    const isCurrentPasswordValid = await user!.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
      return;
    }

    // Mettre à jour le mot de passe
    user!.password = newPassword;
    await user!.save();

    res.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du changement de mot de passe'
    });
  }
};

// @desc    Déconnexion (côté serveur - token reste valide)
// @route   POST /api/auth/logout
// @access  Private
export const logout = (req: Request, res: Response<IApiResponse>): void => {
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
};