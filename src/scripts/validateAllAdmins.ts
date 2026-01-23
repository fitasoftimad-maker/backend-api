import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../../.env') });

const validateAdmins = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI non défini');
        }

        console.log('🔄 Connexion à MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ Connecté à MongoDB');

        console.log('🔍 Recherche des administrateurs non validés...');
        const result = await User.updateMany(
            { role: 'admin', isValidated: { $ne: true } },
            { $set: { isValidated: true, isActive: true } }
        );

        console.log(`✅ Mise à jour terminée : ${result.modifiedCount} administrateurs validés.`);

        // Vérifier les admins existants
        const allAdmins = await User.find({ role: 'admin' }).select('email isValidated');
        console.log('📋 Liste actuelle des administrateurs :');
        allAdmins.forEach(admin => {
            console.log(`- ${admin.email}: ${admin.isValidated ? 'Validé ✅' : 'En attente ❌'}`);
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Déconnecté de MongoDB');
        process.exit(0);
    }
};

validateAdmins();
