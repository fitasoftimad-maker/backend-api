# Softimad Backend API

Backend API pour Softimad - Système d'administration avec authentification JWT et tableau de bord personnalisable.

## 🚀 Déploiement sur Render

### Prérequis
- Compte [Render](https://render.com)
- Base de données [MongoDB Atlas](https://www.mongodb.com/atlas)
- Repository GitHub

### Configuration Render

1. **Créer un nouveau service Web** sur Render
2. **Connecter votre repository GitHub** : `https://github.com/fitasoftimad-maker/backend-api.git`
3. **Configuration du service** :
   - **Runtime** : `Node`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Node Version** : `18.17.0` ou supérieure

### Variables d'environnement (Environment Variables)

Ajoutez ces variables dans les paramètres de votre service Render :

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
JWT_SECRET=votre_cle_secrete_jwt_super_longue_et_complexe_ici
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@softimad.com
ADMIN_PASSWORD=admin123456
FRONTEND_URL=https://votredomaine.com
```

### Générer le JWT_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[System.Web.Security.Membership]::GeneratePassword(32,0)
```

## 🔧 Développement Local

### Installation
```bash
npm install
```

### Configuration
1. Copiez `.env.example` vers `.env`
2. Configurez vos variables d'environnement

### Démarrage
```bash
# Développement avec hot-reload
npm run dev

# Production
npm run build
npm start
```

## 📡 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur
- `POST /api/auth/logout` - Déconnexion

### Dashboard
- `GET /api/dashboard` - Récupérer le dashboard
- `POST /api/dashboard` - Créer un widget
- `PUT /api/dashboard/:id` - Modifier un widget
- `DELETE /api/dashboard/:id` - Supprimer un widget

### Time Tracking
- `POST /api/timetracking/checkin` - Pointer arrivée
- `POST /api/timetracking/checkout` - Pointer départ
- `GET /api/timetracking/monthly` - Statistiques mensuelles
- `GET /api/timetracking/today` - Pointage du jour

## 🔒 Sécurité

- **JWT Authentication** : Tokens sécurisés avec expiration
- **Bcrypt** : Hashage des mots de passe
- **Helmet** : Headers de sécurité HTTP
- **Rate Limiting** : Protection contre les attaques par déni de service
- **CORS** : Contrôle des origines autorisées
- **Input Validation** : Validation des données entrantes

## 🗄️ Base de Données

### Modèles
- **User** : Utilisateurs avec rôles (admin/user)
- **Dashboard** : Widgets personnalisables
- **TimeTracking** : Suivi des heures travaillées

### Index et Performance
- Index optimisés sur les champs fréquemment recherchés
- Validation des données côté base de données
- Relations optimisées avec Mongoose

## 📊 Monitoring

### Health Check
- `GET /api/health` - État du service

### Logs
- Morgan pour les logs HTTP
- Logs d'erreur détaillés en développement

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence ISC.

## 📞 Support

Pour toute question ou problème, créez une issue sur GitHub.