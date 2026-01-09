import mongoose, { Document, Schema, Model, Types } from 'mongoose';

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
  breakHours?: number; // total des pauses en heures
  netHours?: number; // heures nettes (total - pauses)
  status: 'present' | 'absent' | 'late' | 'partial' | 'in_progress' | 'completed';
  notes?: string;
  isPaused?: boolean;
  lastResumeTime?: Date;
}

export interface ITimeTrackingDocument extends Document {
  user: Types.ObjectId;
  month: number;
  year: number;
  entries: ITimeEntry[];
  totalHoursMonth: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITimeTrackingModel extends Model<ITimeTrackingDocument> {
  getCurrentMonthTracking(userId: Types.ObjectId): Promise<ITimeTrackingDocument | null>;
  createOrUpdateEntry(userId: Types.ObjectId, entry: Partial<ITimeEntry>): Promise<ITimeTrackingDocument>;
  getTodayRealTimeStatus(userId: Types.ObjectId): Promise<{
    entry: ITimeEntry | null;
    currentTime: Date;
    totalHours: number;
    breakHours: number;
    netHours: number;
    isWorking: boolean;
    isPaused: boolean;
    timeToEightHours: number;
  } | null>;
}

const breakSchema = new Schema({
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  }
}, { _id: false });

const timeEntrySchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  breaks: [breakSchema],
  totalHours: {
    type: Number,
    default: 0
  },
  breakHours: {
    type: Number,
    default: 0
  },
  netHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'partial', 'in_progress', 'completed'],
    default: 'absent'
  },
  notes: {
    type: String,
    default: ''
  },
  isPaused: {
    type: Boolean,
    default: false
  },
  lastResumeTime: {
    type: Date
  }
}, { _id: false });

const timeTrackingSchema: Schema<ITimeTrackingDocument> = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true,
    min: 2020,
    max: 2030
  },
  entries: [timeEntrySchema],
  totalHoursMonth: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index composé pour éviter les doublons
timeTrackingSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

// Méthode pour obtenir le suivi du mois en cours
timeTrackingSchema.statics.getCurrentMonthTracking = async function(
  userId: Types.ObjectId
): Promise<ITimeTrackingDocument | null> {
  const now = new Date();
  return this.findOne({
    user: userId,
    month: now.getMonth() + 1,
    year: now.getFullYear()
  });
};

// Fonction utilitaire pour calculer les heures d'une entrée
function calculateEntryHours(entry: ITimeEntry): void {
  if (!entry.checkIn) {
    entry.totalHours = 0;
    entry.breakHours = 0;
    entry.netHours = 0;
    return;
  }

  const endTime = entry.checkOut || new Date();

  // Calculer le temps total travaillé
  entry.totalHours = (endTime.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);

  // Calculer le temps des pauses
  entry.breakHours = entry.breaks.reduce((total: number, break_: IBreak) => {
    if (break_.end) {
      // Pause terminée
      return total + (break_.end.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    } else {
      // Pause en cours
      return total + (new Date().getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    }
  }, 0);

  // Heures nettes = total - pauses
  entry.netHours = Math.max(0, entry.totalHours - entry.breakHours);

  // Déterminer le statut
  if (!entry.checkOut) {
    entry.status = entry.isPaused ? 'in_progress' : 'in_progress';
  } else {
    entry.status = entry.netHours >= 8 ? 'completed' : entry.netHours >= 4 ? 'partial' : 'present';
  }

  // Vérifier si on atteint 8h nettes (auto-déclenchement départ)
  if (entry.netHours >= 8 && !entry.checkOut) {
    entry.checkOut = new Date();
    entry.status = 'completed';
  }
}

// Méthode pour créer ou mettre à jour une entrée avec gestion des pauses
timeTrackingSchema.statics.createOrUpdateEntry = async function(
  userId: Types.ObjectId,
  entryData: Partial<ITimeEntry>
): Promise<ITimeTrackingDocument> {
  const entryDate = new Date(entryData.date!);
  const month = entryDate.getMonth() + 1;
  const year = entryDate.getFullYear();

  // Trouver ou créer le document du mois
  let tracking = await this.findOne({ user: userId, month, year });

  if (!tracking) {
    tracking = new this({
      user: userId,
      month,
      year,
      entries: []
    });
  }

  // Trouver l'entrée existante pour cette date
  const existingEntryIndex = tracking.entries.findIndex(
    (entry: ITimeEntry) => entry.date.toDateString() === entryDate.toDateString()
  );

  if (existingEntryIndex >= 0) {
    // Mettre à jour l'entrée existante
    Object.assign(tracking.entries[existingEntryIndex], entryData);

    // Recalculer les heures avec les pauses
    const entry = tracking.entries[existingEntryIndex];
    calculateEntryHours(entry);
  } else {
    // Créer une nouvelle entrée
    const newEntry = { ...entryData, breaks: entryData.breaks || [] } as ITimeEntry;
    tracking.entries.push(newEntry);
  }

  // Recalculer le total du mois (heures nettes)
  tracking.totalHoursMonth = tracking.entries.reduce(
    (total: number, entry: ITimeEntry) => total + (entry.netHours || 0),
    0
  );

  return tracking.save();
};

// Méthode pour calculer les heures d'une entrée
timeTrackingSchema.statics.calculateEntryHours = function(entry: ITimeEntry): void {
  if (!entry.checkIn) {
    entry.totalHours = 0;
    entry.breakHours = 0;
    entry.netHours = 0;
    return;
  }

  const endTime = entry.checkOut || new Date();

  // Calculer le temps total travaillé
  entry.totalHours = (endTime.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);

  // Calculer le temps des pauses
  entry.breakHours = entry.breaks.reduce((total: number, break_: IBreak) => {
    if (break_.end) {
      // Pause terminée
      return total + (break_.end.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    } else {
      // Pause en cours
      return total + (new Date().getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    }
  }, 0);

  // Heures nettes = total - pauses
  entry.netHours = Math.max(0, entry.totalHours - entry.breakHours);

  // Déterminer le statut
  if (!entry.checkOut) {
    entry.status = entry.isPaused ? 'in_progress' : 'in_progress';
  } else {
    entry.status = entry.netHours >= 8 ? 'completed' : entry.netHours >= 4 ? 'partial' : 'present';
  }

  // Vérifier si on atteint 8h nettes (auto-déclenchement départ)
  if (entry.netHours >= 8 && !entry.checkOut) {
    entry.checkOut = new Date();
    entry.status = 'completed';
  }
};

// Méthode pour obtenir le status temps réel d'une journée
timeTrackingSchema.statics.getTodayRealTimeStatus = async function(
  userId: Types.ObjectId
): Promise<{
  entry: ITimeEntry | null;
  currentTime: Date;
  totalHours: number;
  breakHours: number;
  netHours: number;
  isWorking: boolean;
  isPaused: boolean;
  timeToEightHours: number; // minutes restantes jusqu'à 8h
} | null> {
  const now = new Date();
  const tracking = await this.findOne({
    user: userId,
    month: now.getMonth() + 1,
    year: now.getFullYear()
  });
  if (!tracking) return null;

  const today = new Date().toDateString();
  const entry = tracking.entries.find(
    (entry: ITimeEntry) => entry.date.toDateString() === today
  );

  if (!entry || !entry.checkIn) {
    return {
      entry: null,
      currentTime: new Date(),
      totalHours: 0,
      breakHours: 0,
      netHours: 0,
      isWorking: false,
      isPaused: false,
      timeToEightHours: 8 * 60 // 8 heures en minutes
    };
  }

  // Recalculer les heures en temps réel
  calculateEntryHours(entry);

  const targetEightHours = 8 * 60 * 60 * 1000; // 8h en ms
  const workedMs = entry.netHours * 60 * 60 * 1000;
  const remainingMs = Math.max(0, targetEightHours - workedMs);
  const timeToEightHours = remainingMs / (1000 * 60); // en minutes

  return {
    entry,
    currentTime: new Date(),
    totalHours: entry.totalHours,
    breakHours: entry.breakHours,
    netHours: entry.netHours,
    isWorking: !entry.checkOut,
    isPaused: entry.isPaused || false,
    timeToEightHours
  };
};

export default mongoose.model<ITimeTrackingDocument, ITimeTrackingModel>('TimeTracking', timeTrackingSchema);