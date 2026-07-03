/**
 * Tests du client API Web Spotify
 * ===============================
 *
 * Ici on mocke deux choses :
 *  - getValidSession (le module ../auth) → on simule un utilisateur connecté,
 *  - global.fetch → on simule les réponses HTTP de api.spotify.com.
 * Ça permet de vérifier que nos fonctions envoient les bonnes requêtes
 * (URL, méthode, headers) et transforment correctement les réponses.
 */
import { getMyProfile, searchTracks, playTrack, SpotifyApiError } from '../api';
import { getValidSession } from '../auth';

jest.mock('../auth', () => ({
  getValidSession: jest.fn(),
}));

const mockGetValidSession = getValidSession as jest.Mock;

/** Petit helper : fabrique une fausse réponse fetch. */
function fakeResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('api Spotify', () => {
  beforeEach(() => {
    mockGetValidSession.mockResolvedValue({
      accessToken: 'token-abc',
      refreshToken: 'r',
      expiresAt: Date.now() + 3600_000,
      role: 'basic',
    });
    global.fetch = jest.fn();
  });

  it('envoie le header Authorization: Bearer sur chaque requête', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(fakeResponse(200, { id: 'u1' }));

    await getMyProfile();

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me');
    expect(init.headers.Authorization).toBe('Bearer token-abc');
  });

  it('lève une erreur 401 claire si personne n’est connecté', async () => {
    mockGetValidSession.mockResolvedValue(null);
    await expect(getMyProfile()).rejects.toThrow(SpotifyApiError);
    await expect(getMyProfile()).rejects.toMatchObject({ status: 401 });
  });

  it('mappe le profil Spotify vers notre type SpotifyProfile', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      fakeResponse(200, {
        id: 'titouan',
        display_name: 'Titouan',
        images: [{ url: 'https://img/avatar.jpg' }],
        product: 'premium',
      })
    );

    expect(await getMyProfile()).toEqual({
      id: 'titouan',
      displayName: 'Titouan',
      avatarUrl: 'https://img/avatar.jpg',
      product: 'premium',
    });
  });

  it('gère un profil minimal (pas de photo, pas de display_name)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      fakeResponse(200, { id: 'anon', images: [] })
    );

    expect(await getMyProfile()).toEqual({
      id: 'anon',
      displayName: 'anon', // repli sur l'id
      avatarUrl: null,
      product: 'free', // repli prudent : on ne suppose jamais Premium
    });
  });

  it('mappe les résultats de recherche (plusieurs artistes joints par ", ")', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      fakeResponse(200, {
        tracks: {
          items: [
            {
              uri: 'spotify:track:xyz',
              name: 'Nightcall',
              artists: [{ name: 'Kavinsky' }, { name: 'Lovefoxxx' }],
              album: { images: [{ url: 'https://img/cover.jpg' }] },
              duration_ms: 258000,
            },
          ],
        },
      })
    );

    const results = await searchTracks('nightcall');
    expect(results).toEqual([
      {
        uri: 'spotify:track:xyz',
        name: 'Nightcall',
        artist: 'Kavinsky, Lovefoxxx',
        albumArtUrl: 'https://img/cover.jpg',
        durationMs: 258000,
      },
    ]);
    // Vérifie que la query est bien encodée dans l'URL.
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/search?q=nightcall&type=track&limit=10');
  });

  it('ne fait AUCUNE requête pour une recherche vide (économise le quota API)', async () => {
    expect(await searchTracks('   ')).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('playTrack envoie un PUT /me/player/play avec l’URI du morceau', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(fakeResponse(204));

    await playTrack('spotify:track:xyz');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me/player/play');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ uris: ['spotify:track:xyz'] });
  });

  it('remonte le message d’erreur de Spotify (ex: 403 pas de Premium)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      fakeResponse(403, { error: { status: 403, message: 'Player command failed: Premium required' } })
    );

    await expect(playTrack('spotify:track:xyz')).rejects.toMatchObject({
      status: 403,
      message: 'Player command failed: Premium required',
    });
  });
});
