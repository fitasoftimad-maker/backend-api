import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ITaskDocument extends Document {
    user: Types.ObjectId;
    title: string;
    description?: string;
    status: 'en cours' | 'terminé';
    date: Date; // Le jour où la tâche est affichée dans le calendrier
    deadline: Date;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const taskSchema = new Schema<ITaskDocument>({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['en cours', 'terminé'],
        default: 'en cours',
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    deadline: {
        type: Date,
        required: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index composé pour faciliter la recherche par utilisateur et par date
taskSchema.index({ user: 1, date: 1 });

export default mongoose.model<ITaskDocument>('Task', taskSchema);
