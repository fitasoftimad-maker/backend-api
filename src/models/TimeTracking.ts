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
function calculateEntryHours(entry: ITimeEntry, forceCheckout: boolean = false): { shouldAutoCheckout: boolean; autoCheckoutReason?: string } {
  if (!entry.checkIn) {
    entry.totalHours = 0;
    entry.breakHours = 0;
    entry.netHours = 0;
    return { shouldAutoCheckout: false };
  }

  const now = new Date();
  const endTime = entry.checkOut || now;

  // Calculer le temps total travaillé
  entry.totalHours = (endTime.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);

  // Calculer le temps des pauses
  entry.breakHours = entry.breaks.reduce((total: number, break_: IBreak) => {
    if (break_.end) {
      // Pause terminée
      return total + (break_.end.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    } else {
      // Pause en cours
      return total + (now.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
    }
  }, 0);

  // Vérifier si on doit déclencher automatiquement le checkout
  let shouldAutoCheckout = false;
  let autoCheckoutReason: string | undefined;

  if (!entry.checkOut) {
    // Vérifier si on a changé de jour (date différente de celle du checkIn)
    const checkInDate = new Date(entry.checkIn);
    const checkInDay = checkInDate.getDate();
    const checkInMonth = checkInDate.getMonth();
    const checkInYear = checkInDate.getFullYear();
    
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const isNewDay = currentYear > checkInYear || 
                     (currentYear === checkInYear && currentMonth > checkInMonth) ||
                     (currentYear === checkInYear && currentMonth === checkInMonth && currentDay > checkInDay);
    
    // Vérifier si on atteint 8h nettes (calcul préliminaire)
    const preliminaryNetHours = Math.max(0, entry.totalHours - entry.breakHours);
    if (preliminaryNetHours >= 8) {
      shouldAutoCheckout = true;
      autoCheckoutReason = '8h atteintes';
    }
    // Vérifier si on arrive à minuit (0h00) ou si on a changé de jour
    else if (now.getHours() === 0 || isNewDay) {
      shouldAutoCheckout = true;
      autoCheckoutReason = isNewDay ? 'nouveau jour' : 'minuit atteint';
    }

    // Déclencher le checkout automatique si nécessaire
    if (shouldAutoCheckout || forceCheckout) {
      // Utiliser la date du jour précédent à 23:59:59 si on est passé à un nouveau jour
      let finalCheckoutTime: Date;
      if (autoCheckoutReason === 'nouveau jour') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);
        finalCheckoutTime = yesterday;
      } else {
        finalCheckoutTime = now;
      }
      
      // Fermer toutes les pauses en cours avant de définir le checkout
      entry.breaks.forEach((break_: IBreak) => {
        if (!break_.end) {
          // Fermer la pause au moment du checkout
          break_.end = finalCheckoutTime;
          break_.duration = (finalCheckoutTime.getTime() - break_.start.getTime()) / (1000 * 60); // en minutes
        }
      });
      
      // Définir le checkout
      entry.checkOut = finalCheckoutTime;
      entry.isPaused = false; // Plus en pause si checkout automatique
      
      // Recalculer les heures avec le nouveau checkout
      entry.totalHours = (finalCheckoutTime.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);
      
      // Recalculer les pauses (toutes sont maintenant terminées)
      entry.breakHours = entry.breaks.reduce((total: number, break_: IBreak) => {
        if (break_.end) {
          return total + (break_.end.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
        } else {
          // Ne devrait plus arriver, mais au cas où
          return total + (finalCheckoutTime.getTime() - break_.start.getTime()) / (1000 * 60 * 60);
        }
      }, 0);
    }
  }

  // Heures nettes = total - pauses (calcul final)
  entry.netHours = Math.max(0, entry.totalHours - entry.breakHours);

  // Déterminer le statut
  if (!entry.checkOut) {
    entry.status = entry.isPaused ? 'in_progress' : 'in_progress';
  } else {
    entry.status = entry.netHours >= 8 ? 'completed' : entry.netHours >= 4 ? 'partial' : 'present';
  }

  return { shouldAutoCheckout, autoCheckoutReason };
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
    // Recalculer les heures pour la nouvelle entrée
    calculateEntryHours(newEntry);
  }

  // Recalculer le total du mois (heures nettes)
  tracking.totalHoursMonth = tracking.entries.reduce(
    (total: number, entry: ITimeEntry) => total + (entry.netHours || 0),
    0
  );

  return tracking.save();
};

// Méthode pour calculer les heures d'une entrée
timeTrackingSchema.statics.calculateEntryHours = function(entry: ITimeEntry): { shouldAutoCheckout: boolean; autoCheckoutReason?: string } {
  return calculateEntryHours(entry);
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

  // Recalculer les heures en temps réel et vérifier si on doit déclencher le checkout automatique
  const { shouldAutoCheckout, autoCheckoutReason } = calculateEntryHours(entry);

  // Si on doit déclencher automatiquement le checkout, sauvegarder
  if (shouldAutoCheckout && !entry.checkOut) {
    // Recalculer le total du mois avec les heures nettes mises à jour
    tracking.totalHoursMonth = tracking.entries.reduce(
      (total: number, e: ITimeEntry) => {
        // Recalculer les heures pour chaque entrée si nécessaire
        if (e.checkIn && !e.checkOut) {
          calculateEntryHours(e);
        }
        return total + (e.netHours || 0);
      },
      0
    );
    
    // Sauvegarder les modifications (checkout automatique et heures nettes)
    await tracking.save();
    
    console.log(`✅ Checkout automatique déclenché pour l'utilisateur ${userId}: ${autoCheckoutReason}`);
  }

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