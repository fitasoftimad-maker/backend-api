import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI non défini dans les variables d\'environnement');
    }

    console.log('🔍 URI MongoDB utilisé:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

    const conn = await mongoose.connect(mongoURI, {
      // Options de connexion Mongoose modernes
    });

    console.log(`✅ Connecté à MongoDB: ${conn.connection.host}`);

    // Gestion des événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur de connexion MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📡 Déconnecté de MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Reconnecté à MongoDB');
    });

  } catch (error) {
    console.error('❌ Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
};