import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITimeEntry {
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  totalHours?: number;
  status: 'present' | 'absent' | 'late' | 'partial';
  notes?: string;
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
}

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
  totalHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'partial'],
    default: 'absent'
  },
  notes: {
    type: String,
    default: ''
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

// Méthode pour créer ou mettre à jour une entrée
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

    // Recalculer les heures totales si checkIn et checkOut sont présents
    const entry = tracking.entries[existingEntryIndex];
    if (entry.checkIn && entry.checkOut) {
      entry.totalHours = (entry.checkOut.getTime() - entry.checkIn.getTime()) / (1000 * 60 * 60);
      entry.status = entry.totalHours >= 8 ? 'present' : 'partial';
    }
  } else {
    // Créer une nouvelle entrée
    tracking.entries.push(entryData as ITimeEntry);
  }

    // Recalculer le total du mois
    tracking.totalHoursMonth = tracking.entries.reduce(
      (total: number, entry: ITimeEntry) => total + (entry.totalHours || 0),
      0
    );

  return tracking.save();
};

export default mongoose.model<ITimeTrackingDocument, ITimeTrackingModel>('TimeTracking', timeTrackingSchema);