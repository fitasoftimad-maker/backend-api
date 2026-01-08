// Types pour les réponses API
export interface IApiResponse {
  success: boolean;
  message: string;
  data?: any;
  errors?: any[];
}

// Types pour l'authentification
export interface IAuthRequest {
  username?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'user' | 'admin';
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IUpdateProfileRequest {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Types pour les utilisateurs
export interface IUser {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'user' | 'admin';
  isActive?: boolean;
  lastLogin?: Date;
  loginAttempts?: number;
  lockUntil?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Types pour le dashboard
export interface IDashboardStats {
  totalUsers?: number;
  activeUsers?: number;
  adminUsers?: number;
  recentUsers?: any[];
  timeTracking?: {
    totalHours: number;
    totalEntries: number;
  };
  monthlyStats?: {
    totalHours: number;
    entriesCount: number;
    presentDays: number;
    absentDays: number;
  };
}