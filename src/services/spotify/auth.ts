/**
 * Authentification Spotify — OAuth 2.0 Authorization Code + PKCE
 * ==============================================================
 *
 * C'est LE fichier central de la Phase 1. Déroulé complet d'une connexion :
 *
 *   1. authorize(role)
 *      → construit une AuthRequest (avec un "code_verifier" PKCE généré
 *        aléatoirement et son empreinte "code_challenge"),
 *      → ouvre le navigateur sur accounts.spotify.com,
 *      → l'utilisateur accepte, Spotify redirige vers spotparty://auth?code=...
 *      → le navigateur se ferme, on récupère le `code`.
 *
 *   2. exchangeCodeAsync
 *      → on POSTe le code + le code_verifier à Spotify,
 *      → Spotify vérifie que l'empreinte correspond (c'est ça, PKCE :
 *        seul celui qui a lancé la demande peut finir l'échange),
 *      → on reçoit { access_token, refresh_token, expires_in }.
 *
 *   3. refreshIfNeeded (plus tard, à chaque usage de l'API)
 *      → l'access token expire au bout d'1h ; le refresh token permet
 *        d'en obtenir un neuf silencieusement, sans ré-ouvrir le navigateur.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_DISCOVERY,
  SPOTIFY_REDIRECT_URI,
  SCOPES_BASIC,
  SCOPES_HOST,
} from '../../config/spotify';
import { SpotifyRole } from '../../types';
import { StoredSession, saveSession, loadSession } from './tokenStorage';

// Indispensable : quand le navigateur d'auth redirige vers spotparty://auth,
// cet appel "termine" proprement la session web et rend la main à l'app.
WebBrowser.maybeCompleteAuthSession();

/** Petite marge : on considère le token périmé 60s avant l'heure réelle. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Lance le flux de connexion complet dans le navigateur.
 * Retourne la session persistée, ou null si l'utilisateur a annulé.
 */
export async function authorize(role: SpotifyRole): Promise<StoredSession | null> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error(
      "SPOTIFY_CLIENT_ID manquant. Copie .env.example vers .env et renseigne EXPO_PUBLIC_SPOTIFY_CLIENT_ID (voir README)."
    );
  }

  // usePKCE est activé par défaut par expo-auth-session pour ce type de
  // requête, mais on l'écrit explicitement : c'est le cœur du mécanisme.
  const request = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID,
    scopes: role === 'host' ? SCOPES_HOST : SCOPES_BASIC,
    redirectUri: SPOTIFY_REDIRECT_URI,
    usePKCE: true,
    // showDialog:true force Spotify à réafficher l'écran de consentement,
    // pratique en dev pour tester avec plusieurs comptes sur un même téléphone.
    extraParams: { show_dialog: 'true' },
  });

  // Ouvre le navigateur et attend que l'utilisateur termine (ou annule).
  const result = await request.promptAsync(SPOTIFY_DISCOVERY);

  if (result.type !== 'success' || !result.params.code) {
    // 'cancel' / 'dismiss' : l'utilisateur a fermé la page. Pas une erreur.
    return null;
  }

  // Étape 2 : échange code → tokens. Grâce à PKCE, pas de client_secret.
  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId: SPOTIFY_CLIENT_ID,
      code: result.params.code,
      redirectUri: SPOTIFY_REDIRECT_URI,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    SPOTIFY_DISCOVERY
  );

  const session: StoredSession = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? '',
    // expiresIn est en secondes → on calcule une date absolue en ms.
    expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
    role,
  };

  await saveSession(session);
  return session;
}

/**
 * Garantit un access token valide : celui du stockage s'il est encore bon,
 * sinon un neuf obtenu via le refresh token. Retourne null si l'utilisateur
 * n'est pas connecté (ou si le refresh échoue → il faudra se reconnecter).
 *
 * Toutes les fonctions de api.ts passent par ici avant chaque requête.
 */
export async function getValidSession(): Promise<StoredSession | null> {
  const session = await loadSession();
  if (!session) return null;

  // Token encore valide → on le rend tel quel (cas le plus fréquent).
  if (Date.now() < session.expiresAt - EXPIRY_MARGIN_MS) {
    return session;
  }

  // Token périmé → on tente le refresh silencieux.
  if (!session.refreshToken) return null;
  try {
    const tokens = await AuthSession.refreshAsync(
      {
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken: session.refreshToken,
      },
      SPOTIFY_DISCOVERY
    );

    const refreshed: StoredSession = {
      accessToken: tokens.accessToken,
      // Spotify renvoie parfois un nouveau refresh token ; sinon on garde l'ancien.
      refreshToken: tokens.refreshToken ?? session.refreshToken,
      expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
      role: session.role,
    };
    await saveSession(refreshed);
    return refreshed;
  } catch {
    // Refresh token révoqué ou invalide : l'utilisateur devra se reconnecter.
    return null;
  }
}
