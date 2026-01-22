import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import {
  register,
  login,
  getProfile,
  updateProfile,
  updateUserProfile,
  changePassword,
  logout
} from '../controllers/authController';

import {
  authenticateToken,
  authorizeRole,
  loginLimiter,
  validatePasswordStrength
} from '../middleware/auth';

// Configuration multer pour l'upload des images CIN
const storage = multer.memoryStorage();

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

// Middleware pour gérer les erreurs multer
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Le fichier est trop volumineux. Taille maximale: 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erreur d'upload: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Erreur lors de l\'upload du fichier'
    });
  }
  next();
};

const router = express.Router();

// Routes publiques
router.post('/register', upload.fields([
  { name: 'cinRecto', maxCount: 1 },
  { name: 'cinVerso', maxCount: 1 }
]), handleMulterError, [
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

router.put('/profile', upload.fields([
  { name: 'cinRecto', maxCount: 1 },
  { name: 'cinVerso', maxCount: 1 }
]), handleMulterError, [
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
    .withMessage('Le type de contrat doit être CDI, CDD, Stagiaire ou Autre')
], updateProfile);

// Route pour mettre à jour le profil d'un utilisateur spécifique (Admin only)
router.put('/profile/:userId', authorizeRole(['admin']), upload.fields([
  { name: 'cinRecto', maxCount: 1 },
  { name: 'cinVerso', maxCount: 1 }
]), handleMulterError, [
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
    .withMessage('Le type de contrat doit être CDI, CDD, Stagiaire ou Autre')
], updateUserProfile);

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