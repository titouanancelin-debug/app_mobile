/**
 * Configuration & initialisation Firebase
 * =======================================
 *
 * 📖 Concept — Firestore comme "backend temps réel" :
 * On n'a pas de serveur à nous. À la place, tous les téléphones lisent et
 * écrivent dans une base de données hébergée par Google (Firestore), et
 * surtout : ils peuvent S'ABONNER à des documents. Quand l'hôte change
 * l'état de la room (ex: "round 3 en cours"), tous les téléphones abonnés
 * reçoivent la mise à jour en ~100ms. C'est ce qui synchronise le jeu.
 *
 * Ces clés viennent de la console Firebase (https://console.firebase.google.com)
 * → ton projet → ⚙️ Paramètres du projet → "Vos applications" → app Web.
 * Comme pour le Client ID Spotify, ces valeurs ne sont pas des secrets :
 * la sécurité se joue dans les "Security Rules" de Firestore, pas ici.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// getApps() évite le crash "Firebase App already exists" quand le code
// est rechargé à chaud (Fast Refresh) pendant le développement.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// L'instance Firestore qu'on importera partout ailleurs.
// (Utilisée à partir de la Phase 2 — système de rooms.)
export const db = getFirestore(app);
