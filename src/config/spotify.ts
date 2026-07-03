/**
 * Configuration Spotify
 * =====================
 *
 * Tout ce qui concerne l'application Spotify que tu as créée sur le
 * Spotify Developer Dashboard (https://developer.spotify.com/dashboard)
 * est centralisé ici.
 *
 * 📖 Concept — OAuth 2.0 avec PKCE :
 * Pour qu'un utilisateur nous autorise à agir sur son compte Spotify,
 * on utilise le flux "Authorization Code + PKCE". En résumé :
 *   1. L'app ouvre une page web Spotify où l'utilisateur se connecte.
 *   2. Spotify redirige vers notre app (via le "redirect URI", un lien
 *      spécial `spotparty://auth` que le téléphone sait ouvrir).
 *   3. L'app échange le code reçu contre un access token.
 * PKCE ajoute une preuve cryptographique qui évite d'avoir à embarquer
 * un "client secret" dans l'app (impossible à protéger sur mobile).
 */

// ⚠️ À REMPLIR : le Client ID de ton app sur le Spotify Developer Dashboard.
// On le lit depuis une variable d'environnement Expo (fichier .env, voir
// .env.example à la racine). Les variables préfixées EXPO_PUBLIC_ sont
// injectées dans le bundle JS au build — elles ne sont PAS secrètes,
// mais le Client ID Spotify n'est pas un secret de toute façon.
export const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

// Le redirect URI DOIT être déclaré à l'identique dans le dashboard Spotify
// (Settings → Redirect URIs). Le préfixe "spotparty" correspond au champ
// "scheme" de app.json : c'est ce qui permet au téléphone de rouvrir
// notre app à la fin de la connexion Spotify.
export const SPOTIFY_REDIRECT_URI = 'spotparty://auth';

// Les "endpoints" officiels du serveur OAuth de Spotify.
// expo-auth-session appelle ça un objet "discovery".
export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// Racine de l'API Web Spotify (recherche, profil, contrôle de lecture…).
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

/**
 * 📖 Concept — les "scopes" :
 * Un scope est une permission qu'on demande à l'utilisateur.
 * Moins on en demande, moins l'écran de consentement fait peur.
 *
 * - Joueur "basique" : il ne fait que chercher des morceaux et lire son
 *   profil. La recherche ne demande AUCUN scope particulier, juste un
 *   token valide.
 * - Hôte : en plus, son téléphone pilote la lecture de l'app Spotify
 *   via l'API "Spotify Connect" → il faut les scopes de playback.
 *   (C'est aussi lui qui doit être Premium.)
 */
export const SCOPES_BASIC = [
  'user-read-private', // profil : pseudo, avatar, pays
  'user-read-email',
];

export const SCOPES_HOST = [
  ...SCOPES_BASIC,
  'user-read-playback-state',   // lire l'état de lecture (quel morceau, quel appareil)
  'user-modify-playback-state', // lancer/mettre en pause un morceau sur son appareil
];
