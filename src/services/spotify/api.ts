/**
 * Client de l'API Web Spotify
 * ===========================
 *
 * Toutes les requêtes HTTP vers api.spotify.com passent par ici.
 * Le point important est `apiFetch` : il récupère automatiquement un
 * token valide (rafraîchi si besoin) avant CHAQUE requête, pour que le
 * reste du code n'ait jamais à penser aux tokens.
 */
import { SPOTIFY_API_BASE } from '../../config/spotify';
import { SpotifyProfile, SpotifyTrackResult } from '../../types';
import { getValidSession } from './auth';

/** Erreur typée pour que les écrans puissent afficher un message utile. */
export class SpotifyApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

/**
 * Wrapper autour de fetch() qui ajoute le header d'authentification.
 * 📖 Concept : une API REST authentifiée attend un header
 * "Authorization: Bearer <access_token>" sur chaque requête.
 */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getValidSession();
  if (!session) {
    throw new SpotifyApiError('Non connecté à Spotify', 401);
  }

  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // Spotify renvoie un JSON { error: { message } } sur la plupart des erreurs.
    let message = `Erreur Spotify (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // corps vide ou non-JSON : on garde le message générique
    }
    throw new SpotifyApiError(message, response.status);
  }

  return response;
}

/**
 * GET /v1/me — profil de l'utilisateur connecté.
 * C'est aussi comme ça qu'on sait s'il est Premium (champ `product`).
 */
export async function getMyProfile(): Promise<SpotifyProfile> {
  const res = await apiFetch('/me');
  const data = await res.json();
  return {
    id: data.id,
    displayName: data.display_name ?? data.id,
    // `images` est un tableau (plusieurs tailles) potentiellement vide.
    avatarUrl: data.images?.[0]?.url ?? null,
    product: data.product ?? 'free',
  };
}

/**
 * GET /v1/search — recherche de morceaux (utilisée en Phase 3).
 * Aucun scope particulier requis : un token "basic" suffit.
 */
export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrackResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
  const res = await apiFetch(`/search?${params}`);
  const data = await res.json();

  return (data.tracks?.items ?? []).map((item: any): SpotifyTrackResult => ({
    uri: item.uri,
    name: item.name,
    // Un morceau peut avoir plusieurs artistes → on les joint par ", ".
    artist: item.artists.map((a: any) => a.name).join(', '),
    albumArtUrl: item.album?.images?.[0]?.url ?? null,
    durationMs: item.duration_ms,
  }));
}

// ---------------------------------------------------------------------------
// Contrôle de lecture via Spotify Connect (utilisé en Phase 4, côté hôte)
// ---------------------------------------------------------------------------
// 📖 Concept : ces endpoints pilotent l'app Spotify OFFICIELLE qui tourne
// sur le téléphone de l'hôte. Notre app ne décode pas d'audio elle-même :
// elle envoie des ordres ("joue ce morceau") et Spotify obéit.
// Nécessite : compte Premium + scope user-modify-playback-state +
// l'app Spotify ouverte récemment (sinon aucun "device actif").

/** Lance la lecture d'un morceau sur l'appareil actif de l'hôte. */
export async function playTrack(spotifyUri: string): Promise<void> {
  await apiFetch('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify({ uris: [spotifyUri] }),
  });
}

/** Met la lecture en pause. */
export async function pausePlayback(): Promise<void> {
  await apiFetch('/me/player/pause', { method: 'PUT' });
}
