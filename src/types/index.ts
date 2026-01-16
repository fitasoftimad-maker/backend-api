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
  confirmPassword?: string;
  firstName: string;
  lastName: string;
  cin?: string;
  contractType?: 'CDI' | 'CDD' | 'Stagiaire' | 'Autre';
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
  cin?: string;
  contractType?: 'CDI' | 'CDD' | 'Stagiaire' | 'Autre';
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

// Types pour le time tracking amélioré
export interface IBreak {
  start: Date;
  end?: Date;
  duration?: number; // en minutes
}

export interface ITimeEntry {
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  breaks: IBreak[];
  totalHours?: number;
  breakHours?: number;
  netHours?: number;
  status: 'present' | 'absent' | 'late' | 'partial' | 'in_progress' | 'completed';
  notes?: string;
  isPaused?: boolean;
  lastResumeTime?: Date;
}

export interface IRealTimeStatus {
  entry: ITimeEntry | null;
  currentTime: Date;
  totalHours: number;
  breakHours: number;
  netHours: number;
  isWorking: boolean;
  isPaused: boolean;
  timeToEightHours: number; // minutes restantes
}

export interface IWeeklyTotal {
  week: number;
  startDate: Date;
  endDate: Date;
  totalHours: number;
  entries: number;
}

export interface ITimeTrackingHistory {
  tracking: {
    entries: ITimeEntry[];
    totalHoursMonth: number;
    month: number;
    year: number;
  };
  weeklyTotals: IWeeklyTotal[];
  month: number;
  year: number;
}