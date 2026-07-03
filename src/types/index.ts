/**
 * Modèle de données du jeu
 * ========================
 *
 * Ces types TypeScript décrivent la forme des documents qu'on stockera
 * dans Firestore (Phase 2+). Les définir dès maintenant sert de "contrat" :
 * tout le code (écrans, services) parle le même langage.
 *
 * Organisation Firestore prévue :
 *   rooms/{code}                    → Room
 *   rooms/{code}/players/{playerId} → Player
 *   rooms/{code}/tracks/{trackId}   → Track
 *   rooms/{code}/rounds/{roundId}   → Round (les votes sont dedans)
 */

/** Les grandes étapes d'une partie. */
export type GamePhase =
  | 'lobby'      // les joueurs rejoignent
  | 'picking'    // chacun ajoute ses morceaux
  | 'playing'    // un morceau joue, on vote
  | 'reveal'     // on révèle qui a ajouté le morceau
  | 'finished';  // classement final

export interface Room {
  /** Code court à partager entre amis, ex: "K7F3QZ". Sert aussi d'ID Firestore. */
  code: string;
  /** ID du joueur hôte (celui dont le téléphone joue le son). */
  hostId: string;
  phase: GamePhase;
  /** Index du round en cours (0 = premier morceau), null tant qu'on n'a pas commencé. */
  currentRound: number | null;
  /** Nombre de morceaux que chaque joueur doit ajouter (1 ou 2). */
  tracksPerPlayer: number;
  createdAt: number; // timestamp ms
}

export interface Player {
  id: string;
  /** Pseudo affiché dans le jeu (par défaut : display_name Spotify). */
  nickname: string;
  /** URL de l'avatar (photo de profil Spotify, si elle existe). */
  avatarUrl: string | null;
  isHost: boolean;
  score: number;
  /** Le joueur a fini d'ajouter ses morceaux (phase "picking"). */
  isReady: boolean;
  joinedAt: number;
}

export interface Track {
  /** URI Spotify, ex: "spotify:track:4uLU6hMCjMI75M1A2tKUQC". C'est ce qu'on envoie à l'API pour lancer la lecture. */
  spotifyUri: string;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  durationMs: number;
  /** Qui l'a ajouté — l'info à deviner ! Ne jamais l'afficher avant le reveal. */
  addedBy: string;
  /** Position dans l'ordre de passage mélangé (fixée au lancement de la partie). */
  playOrder: number | null;
  played: boolean;
}

export interface Vote {
  voterId: string;
  /** Le joueur que le votant soupçonne d'avoir ajouté le morceau. */
  targetPlayerId: string;
  votedAt: number;
}

export interface Round {
  /** ID Firestore du Track joué pendant ce round. */
  trackId: string;
  /** Votes reçus, indexés par voterId (un joueur = un vote, facile à écraser s'il change d'avis). */
  votes: Record<string, Vote>;
  /** Passé à true par l'hôte quand tout le monde a voté → déclenche le reveal partout. */
  revealed: boolean;
}

// ---------------------------------------------------------------------------
// Types côté Spotify (indépendants de Firestore)
// ---------------------------------------------------------------------------

/** Le rôle choisi à la connexion : détermine les scopes OAuth demandés. */
export type SpotifyRole = 'basic' | 'host';

/** Profil renvoyé par GET /v1/me (on ne garde que ce qui nous sert). */
export interface SpotifyProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** "premium" ou "free" — crucial : l'hôte DOIT être premium pour piloter la lecture. */
  product: string;
}

/** Un résultat de recherche de morceau (Phase 3). */
export interface SpotifyTrackResult {
  uri: string;
  name: string;
  artist: string;
  albumArtUrl: string | null;
  durationMs: number;
}
