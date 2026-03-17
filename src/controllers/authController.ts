import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import multer from 'multer';
import User, { IUserDocument } from '../models/User';
import Dashboard from '../models/Dashboard';
import TimeTracking from '../models/TimeTracking';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { IAuthRequest, ILoginRequest, IUpdateProfileRequest, IChangePasswordRequest, IApiResponse } from '../types';
import { sendUserRegistrationEmail, sendPasswordResetEmail } from '../services/emailService';

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
    console.log('🔍 Fichiers reçus:', req.files);
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

    const { email, password, confirmPassword, firstName, lastName, cin, contractType, role } = req.body;

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Les mots de passe ne correspondent pas'
      });
      return;
    }

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

    const cinRectoFile = (req.files as any)?.cinRecto?.[0];
    const cinVersoFile = (req.files as any)?.cinVerso?.[0];

    let cinRectoBase64 = null;
    let cinVersoBase64 = null;

    try {
      if (cinRectoFile) {
        console.log('📸 Traitement CIN Recto:', {
          filename: cinRectoFile.originalname,
          mimetype: cinRectoFile.mimetype,
          size: cinRectoFile.size
        });
        cinRectoBase64 = `data:${cinRectoFile.mimetype};base64,${cinRectoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Recto converti en base64, longueur:', cinRectoBase64.length);
      }
      if (cinVersoFile) {
        console.log('📸 Traitement CIN Verso:', {
          filename: cinVersoFile.originalname,
          mimetype: cinVersoFile.mimetype,
          size: cinVersoFile.size
        });
        cinVersoBase64 = `data:${cinVersoFile.mimetype};base64,${cinVersoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Verso converti en base64, longueur:', cinVersoBase64.length);
      }
    } catch (fileError: any) {
      console.error('❌ Erreur lors du traitement des fichiers CIN:', fileError);
      throw new Error(`Erreur lors du traitement des images CIN: ${fileError.message}`);
    }

    // Créer l'utilisateur avec le rôle spécifié
    // Les admins sont validés par défaut, les users doivent attendre la validation
    const userRole = role || 'user';
    let isValidated = false;

    if (userRole === 'admin') {
      // Si c'est un admin, on vérifie s'il y a déjà un admin validé
      const adminExists = await User.findOne({ role: 'admin', isValidated: true });
      if (!adminExists) {
        // Pas d'admin existant, on valide automatiquement le premier
        isValidated = true;
        console.log('👑 Premier administrateur détecté, validation automatique.');
      } else {
        // Un admin existe déjà, le nouvel admin doit être validé
        isValidated = false;
        console.log('⏳ Administrateur existant trouvé, validation requise pour le nouveau.');
      }
    } else {
      // Les utilisateurs standards sont maintenant validés par défaut
      isValidated = true;
      console.log('👤 Nouvel utilisateur détecté, validation automatique.');
    }

    const user: IUserDocument = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      cin,
      contractType,
      cinRecto: cinRectoBase64,
      cinVerso: cinVersoBase64,
      role: userRole,
      isValidated: isValidated
    });

    // Envoyer un email à l'admin pour notification (seulement pour les users, pas les admins)
    if (!isValidated) {
      try {
        await sendUserRegistrationEmail({
          firstName,
          lastName,
          email,
          cin,
          contractType,
          role: userRole
        });
        console.log('✅ Email de notification envoyé à l\'admin');
      } catch (emailError) {
        console.error('⚠️ Erreur lors de l\'envoi de l\'email (non bloquant):', emailError);
        // Ne pas faire échouer l'inscription si l'email échoue
      }
    }

    // Créer les widgets par défaut pour le tableau de bord seulement si validé
    if (isValidated) {
      await Dashboard.createDefaultWidgets(user._id);
    }

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
          cin: user.cin,
          cinRecto: user.cinRecto || null,
          cinVerso: user.cinVerso || null,
          contractType: user.contractType,
          role: user.role,
          avatar: user.avatar,
          isValidated: user.isValidated
        },
        token
      }
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'inscription:', error);
    console.error('❌ Stack trace:', error?.stack);
    console.error('❌ Détails:', {
      message: error?.message,
      name: error?.name,
      code: error?.code
    });
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? `Erreur serveur lors de l'inscription: ${error?.message || 'Erreur inconnue'}`
        : 'Erreur serveur lors de l\'inscription'
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

    // Vérifier si le compte est validé
    if (!user.isValidated) {
      res.status(403).json({
        success: false,
        message: 'Compte en attente de validation',
        data: {
          isValidated: false,
          user: {
            id: user._id.toString(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
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
          cin: user.cin,
          cinRecto: user.cinRecto || null,
          cinVerso: user.cinVerso || null,
          contractType: user.contractType,
          role: user.role,
          avatar: user.avatar,
          lastLogin: user.lastLogin,
          isValidated: user.isValidated
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
          cin: user!.cin,
          cinRecto: user!.cinRecto || null,
          cinVerso: user!.cinVerso || null,
          contractType: user!.contractType,
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

    const { username, email, firstName, lastName, cin, contractType, avatar } = req.body;

    // Récupérer l'utilisateur actuel pour préserver les images existantes
    const currentUser = await User.findById(req.user!._id);
    if (!currentUser) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

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

    const cinRectoFile = (req.files as any)?.cinRecto?.[0];
    const cinVersoFile = (req.files as any)?.cinVerso?.[0];

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (cin !== undefined) updateData.cin = cin;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Traiter les images CIN
    try {
      // Préserver les images existantes si aucun nouveau fichier n'est fourni
      if (cinRectoFile) {
        console.log('📸 Mise à jour CIN Recto:', {
          filename: cinRectoFile.originalname,
          mimetype: cinRectoFile.mimetype,
          size: cinRectoFile.size
        });
        updateData.cinRecto = `data:${cinRectoFile.mimetype};base64,${cinRectoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Recto mis à jour, longueur:', updateData.cinRecto.length);
      } else {
        // Préserver l'image existante si elle existe
        updateData.cinRecto = currentUser.cinRecto || null;
        console.log('📋 CIN Recto préservé:', currentUser.cinRecto ? 'Oui' : 'Non');
      }

      if (cinVersoFile) {
        console.log('📸 Mise à jour CIN Verso:', {
          filename: cinVersoFile.originalname,
          mimetype: cinVersoFile.mimetype,
          size: cinVersoFile.size
        });
        updateData.cinVerso = `data:${cinVersoFile.mimetype};base64,${cinVersoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Verso mis à jour, longueur:', updateData.cinVerso.length);
      } else {
        // Préserver l'image existante si elle existe
        updateData.cinVerso = currentUser.cinVerso || null;
        console.log('📋 CIN Verso préservé:', currentUser.cinVerso ? 'Oui' : 'Non');
      }
    } catch (fileError: any) {
      console.error('❌ Erreur lors du traitement des fichiers CIN:', fileError);
      throw new Error(`Erreur lors du traitement des images CIN: ${fileError.message}`);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user!._id,
      updateData,
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
          cin: updatedUser!.cin,
          cinRecto: updatedUser!.cinRecto || null,
          cinVerso: updatedUser!.cinVerso || null,
          contractType: updatedUser!.contractType,
          role: updatedUser!.role,
          avatar: updatedUser!.avatar
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour du profil:', error);
    console.error('❌ Stack trace:', error?.stack);
    console.error('❌ Détails:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      userId: req.user!._id
    });
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? `Erreur serveur lors de la mise à jour du profil: ${error?.message || 'Erreur inconnue'}`
        : 'Erreur serveur lors de la mise à jour du profil'
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

// @desc    Mettre à jour le profil d'un utilisateur spécifique (Admin only)
// @route   PUT /api/auth/profile/:userId
// @access  Private (Admin only)
export const updateUserProfile = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
      return;
    }

    const { userId } = req.params;
    const { email, firstName, lastName, cin, contractType } = req.body;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    // Vérifier que le nouvel email n'est pas déjà pris (si changé)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé'
        });
        return;
      }
    }

    const cinRectoFile = (req.files as any)?.cinRecto?.[0];
    const cinVersoFile = (req.files as any)?.cinVerso?.[0];

    // Mettre à jour l'utilisateur
    const updateData: any = {};
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (cin !== undefined) updateData.cin = cin;
    if (contractType) updateData.contractType = contractType;

    // Traiter les images CIN
    try {
      // Préserver les images existantes si aucun nouveau fichier n'est fourni
      if (cinRectoFile) {
        console.log('📸 Admin - Mise à jour CIN Recto:', {
          filename: cinRectoFile.originalname,
          mimetype: cinRectoFile.mimetype,
          size: cinRectoFile.size,
          userId
        });
        updateData.cinRecto = `data:${cinRectoFile.mimetype};base64,${cinRectoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Recto mis à jour, longueur:', updateData.cinRecto.length);
      } else {
        // Préserver l'image existante si elle existe
        updateData.cinRecto = user.cinRecto || null;
        console.log('📋 CIN Recto préservé:', user.cinRecto ? 'Oui' : 'Non');
      }

      if (cinVersoFile) {
        console.log('📸 Admin - Mise à jour CIN Verso:', {
          filename: cinVersoFile.originalname,
          mimetype: cinVersoFile.mimetype,
          size: cinVersoFile.size,
          userId
        });
        updateData.cinVerso = `data:${cinVersoFile.mimetype};base64,${cinVersoFile.buffer.toString('base64')}`;
        console.log('✅ CIN Verso mis à jour, longueur:', updateData.cinVerso.length);
      } else {
        // Préserver l'image existante si elle existe
        updateData.cinVerso = user.cinVerso || null;
        console.log('📋 CIN Verso préservé:', user.cinVerso ? 'Oui' : 'Non');
      }
    } catch (fileError: any) {
      console.error('❌ Erreur lors du traitement des fichiers CIN:', fileError);
      throw new Error(`Erreur lors du traitement des images CIN: ${fileError.message}`);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    res.json({
      success: true,
      message: 'Profil utilisateur mis à jour avec succès',
      data: {
        user: {
          id: updatedUser!._id.toString(),
          username: updatedUser!.username,
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          cin: updatedUser!.cin,
          cinRecto: updatedUser!.cinRecto || null,
          cinVerso: updatedUser!.cinVerso || null,
          contractType: updatedUser!.contractType,
          role: updatedUser!.role,
          createdAt: updatedUser!.createdAt
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour du profil utilisateur:', error);
    console.error('❌ Stack trace:', error?.stack);
    console.error('❌ Détails:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      userId: req.params.userId
    });
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? `Erreur serveur lors de la mise à jour du profil: ${error?.message || 'Erreur inconnue'}`
        : 'Erreur serveur lors de la mise à jour du profil'
    });
  }
};

// @desc    Mot de passe oublié - demande de lien
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email requis'
      });
      return;
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Pour des raisons de sécurité, ne pas indiquer si l'email existe ou non
      res.json({
        success: true,
        message: 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.'
      });
      return;
    }

    // Générer le jeton de réinitialisation
    const resetToken = (user as any).createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Créer l'URL de réinitialisation
    // In production, use the current host or a fixed domain
    const resetUrl = `${req.protocol}://${req.get('host')?.replace('backend-api-9c1n.onrender.com', 'site-vitrine-simple.vercel.app')}/admin/reset-password/${resetToken}`;

    // Note: If the user is on local, req.get('host') might be localhost:5000
    // We ideally want the frontend URL.
    const frontendUrl = process.env.FRONTEND_URL || 'https://site-vitrine-simple.vercel.app';
    const finalResetUrl = `${frontendUrl}/admin/reset-password?token=${resetToken}`;

    try {
      // Assuming sendPasswordResetEmail is imported from '../utils/email'
      // Assuming jwt is imported from 'jsonwebtoken'
      // Assuming crypto is imported from 'crypto'
      await sendPasswordResetEmail(user.email, finalResetUrl);
      res.json({
        success: true,
        message: 'Lien de réinitialisation envoyé à votre adresse email.'
      });
    } catch (err: any) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Erreur lors de l\'envoi de l\'email de réinitialisation:', err);
      res.status(500).json({
        success: false,
        message: `Erreur lors de l'envoi de l'email: ${err.message || 'Erreur inconnue'}`
      });
    }
  } catch (error: any) {
    console.error('Erreur forgotPassword:', error);
    res.status(500).json({
      success: false,
      message: `Erreur serveur lors de la demande de réinitialisation: ${error.message || 'Erreur inconnue'}`
    });
  }
};

// @desc    Réinitialiser le mot de passe avec le jeton
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req: Request, res: Response<IApiResponse>): Promise<void> => {
  try {
    // 1) Obtenir l'utilisateur basé sur le jeton
    // Assuming crypto is imported from 'crypto'
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .update(req.params.token) // Wait, I used req.params.token once in createPasswordResetToken
      .digest('hex');

    // Correction: Match what we did in createPasswordResetToken
    const correctHashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: correctHashedToken,
      passwordResetExpires: { $gt: new Date() }
    });

    // 2) Si le jeton n'a pas expiré et qu'il y a un utilisateur, définir le nouveau mot de passe
    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Le lien est invalide ou a expiré'
      });
      return;
    }

    const { password, confirmPassword } = req.body;

    if (!password || password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Les mots de passe ne correspondent pas'
      });
      return;
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Connecter l'utilisateur, envoyer le token JWT
    // Assuming jwt is imported from 'jsonwebtoken'
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET!, {
      expiresIn: '7d'
    });

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error: any) {
    console.error('Erreur resetPassword:', error);
    res.status(500).json({
      success: false,
      message: `Erreur serveur lors de la réinitialisation du mot de passe: ${error.message || 'Erreur inconnue'}`
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