import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

export interface IUserDocument extends Document {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  cin?: string;
  cinRecto?: string;
  cinVerso?: string;
  contractType?: 'CDI' | 'CDD' | 'Stagiaire' | 'Autre';
  avatar?: string;
  role: 'user' | 'admin';
  isActive?: boolean;
  lastLogin?: Date;
  loginAttempts?: number;
  lockUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  incLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
  isLocked(): boolean;
}

export interface IUserModel extends Model<IUserDocument> {
  createDefaultAdmin(): Promise<void>;
}

const userSchema = new Schema({
  username: {
    type: String,
    required: [true, 'Le nom d\'utilisateur est requis'],
    unique: true,
    trim: true,
    minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
    maxlength: [50, 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Veuillez fournir un email valide'
    }
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false // Ne pas inclure dans les requêtes par défaut
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  cin: {
    type: String,
    trim: true,
    maxlength: [20, 'Le numéro CIN ne peut pas dépasser 20 caractères'],
    match: [/^[0-9]+$/, 'Le numéro CIN ne peut contenir que des chiffres']
  },
  cinRecto: {
    type: String,
    default: null
  },
  cinVerso: {
    type: String,
    default: null
  },
  contractType: {
    type: String,
    enum: ['CDI', 'CDD', 'Stagiaire', 'Autre'],
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index pour les performances (les index sont déjà définis dans les champs unique)

// Méthode pour vérifier si le compte est verrouillé
userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Méthode pour incrémenter les tentatives de connexion
userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  const updates: any = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = {
      lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // Verrouillage 2h
    };
  }

  return this.updateOne(updates);
};

// Méthode pour réinitialiser les tentatives de connexion
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Middleware pour hasher le mot de passe avant la sauvegarde
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Middleware pour transformer l'email en minuscules
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Méthode statique pour créer un admin par défaut
userSchema.statics.createDefaultAdmin = async function() {
  try {
    const adminExists = await this.findOne({ role: 'admin' });
    if (!adminExists) {
      const defaultAdmin = new this({
        username: 'admin',
        email: 'admin@softimad.com',
        password: 'Admin123!',
        role: 'admin',
        firstName: 'Admin',
        lastName: 'Softimad',
        isActive: true
      });
      await defaultAdmin.save();
      console.log('✅ Admin par défaut créé: admin@softimad.com / Admin123!');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'admin par défaut:', error);
  }
};

export default mongoose.model('User', userSchema) as unknown as IUserModel;
