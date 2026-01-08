import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IDashboardWidget {
  title: string;
  type: string;
  content: string;
  color: string;
  position: number;
  user: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDashboardDocument extends Document {
  title: string;
  type: string;
  content: string;
  color: string;
  position: number;
  user: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDashboardModel extends Model<IDashboardDocument> {
  createDefaultWidgets(userId: Types.ObjectId): Promise<void>;
}

const dashboardSchema: Schema<IDashboardDocument> = new Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['stats', 'chart', 'notes', 'tasks', 'project_list']
  },
  content: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#3b82f6'
  },
  position: {
    type: Number,
    default: 0
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Méthode statique pour créer les widgets par défaut
dashboardSchema.statics.createDefaultWidgets = async function(userId: Types.ObjectId): Promise<void> {
  try {
    const defaultWidgets = [
      {
        title: 'Statistiques utilisateurs',
        type: 'stats',
        content: 'Nombre total d\'utilisateurs inscrits',
        color: '#3b82f6',
        position: 0,
        user: userId
      },
      {
        title: 'Projets actifs',
        type: 'chart',
        content: 'Graphique des projets en cours',
        color: '#10b981',
        position: 1,
        user: userId
      },
      {
        title: 'Tâches à faire',
        type: 'tasks',
        content: 'Liste des tâches prioritaires',
        color: '#f59e0b',
        position: 2,
        user: userId
      },
      {
        title: 'Notes importantes',
        type: 'notes',
        content: 'Espace pour vos notes importantes',
        color: '#8b5cf6',
        position: 3,
        user: userId
      }
    ];

    await this.insertMany(defaultWidgets);
    console.log(`✅ Widgets par défaut créés pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error('❌ Erreur lors de la création des widgets par défaut:', error);
    throw error;
  }
};

export default mongoose.model<IDashboardDocument, IDashboardModel>('Dashboard', dashboardSchema);