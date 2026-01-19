import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
} from '../controllers/authController';

import {
  authenticateToken,
  loginLimiter,
  validatePasswordStrength
} from '../middleware/auth';

// Configuration multer pour l'upload des images CIN
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/cin');
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom unique pour le fichier
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter seulement les images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'));
    }
  }
});

const router = express.Router();

// Routes publiques
router.post('/register', upload.fields([
  { name: 'cinRecto', maxCount: 1 },
  { name: 'cinVerso', maxCount: 1 }
]), [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir un email valide')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caractères'),

  body('firstName')
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ max: 50 })
    .withMessage('Le prénom ne peut pas dépasser 50 caractères')
    .trim(),

  body('lastName')
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ max: 50 })
    .withMessage('Le nom ne peut pas dépasser 50 caractères')
    .trim(),

  body('cin')
    .optional()
    .isLength({ min: 1, max: 20 })
    .withMessage('Le numéro CIN doit contenir entre 1 et 20 caractères')
    .matches(/^[0-9]+$/)
    .withMessage('Le numéro CIN ne peut contenir que des chiffres'),

  body('contractType')
    .optional()
    .isIn(['CDI', 'CDD', 'Stagiaire', 'Autre'])
    .withMessage('Le type de contrat doit être CDI, CDD, Stagiaire ou Autre'),

  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Le rôle doit être soit "user", soit "admin"')
], validatePasswordStrength, register);

router.post('/login', loginLimiter, [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir un email valide')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis')
], login);

// Routes protégées
router.use(authenticateToken); // Toutes les routes suivantes nécessitent une authentification

router.get('/profile', getProfile);

router.put('/profile', [
  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 50 caractères')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Veuillez fournir un email valide')
    .normalizeEmail(),

  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Le prénom ne peut pas dépasser 50 caractères')
    .trim(),

  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Le nom ne peut pas dépasser 50 caractères')
    .trim()
], updateProfile);

router.put('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')
], validatePasswordStrength, changePassword);

router.post('/logout', logout);

export default router;