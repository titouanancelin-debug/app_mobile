/**
 * Tests de la logique de session (getValidSession)
 * ================================================
 *
 * On ne peut pas tester le VRAI login OAuth ici (il faut un navigateur,
 * un humain, un compte Spotify). En revanche, la logique autour — "le token
 * est-il encore bon ? faut-il le rafraîchir ? que faire si le refresh
 * échoue ?" — est du pur code, parfaitement testable en mockant
 * expo-auth-session et le stockage.
 */
import { getValidSession } from '../auth';
import { saveSession, loadSession, clearSession } from '../tokenStorage';
import * as AuthSession from 'expo-auth-session';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
  };
});

// On mocke tout expo-auth-session : refreshAsync sera piloté test par test.
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  exchangeCodeAsync: jest.fn(),
  refreshAsync: jest.fn(),
}));

// maybeCompleteAuthSession() est appelé à l'import de auth.ts → à mocker aussi.
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

const mockRefreshAsync = AuthSession.refreshAsync as jest.Mock;

describe('getValidSession', () => {
  beforeEach(async () => {
    await clearSession();
    mockRefreshAsync.mockReset();
  });

  it('retourne null si personne n’est connecté', async () => {
    expect(await getValidSession()).toBeNull();
  });

  it('retourne la session telle quelle si le token est encore valide', async () => {
    await saveSession({
      accessToken: 'still-good',
      refreshToken: 'r',
      expiresAt: Date.now() + 30 * 60 * 1000, // expire dans 30 min
      role: 'basic',
    });

    const session = await getValidSession();
    expect(session?.accessToken).toBe('still-good');
    // Surtout : PAS d'appel réseau de refresh inutile.
    expect(mockRefreshAsync).not.toHaveBeenCalled();
  });

  it('rafraîchit le token quand il est expiré, et persiste le résultat', async () => {
    await saveSession({
      accessToken: 'expired',
      refreshToken: 'refresh-me',
      expiresAt: Date.now() - 1000, // déjà expiré
      role: 'host',
    });
    mockRefreshAsync.mockResolvedValue({
      accessToken: 'fresh-token',
      refreshToken: 'new-refresh',
      expiresIn: 3600,
    });

    const session = await getValidSession();

    expect(session?.accessToken).toBe('fresh-token');
    expect(session?.role).toBe('host'); // le rôle survit au refresh
    // La nouvelle session doit être re-stockée (pour le prochain lancement).
    expect((await loadSession())?.accessToken).toBe('fresh-token');
  });

  it('garde l’ancien refresh token si Spotify n’en renvoie pas de nouveau', async () => {
    await saveSession({
      accessToken: 'expired',
      refreshToken: 'keep-me',
      expiresAt: Date.now() - 1000,
      role: 'basic',
    });
    // Spotify ne renvoie pas toujours un refresh_token dans la réponse.
    mockRefreshAsync.mockResolvedValue({ accessToken: 'fresh', expiresIn: 3600 });

    const session = await getValidSession();
    expect(session?.refreshToken).toBe('keep-me');
  });

  it('retourne null si le refresh échoue (token révoqué → reconnexion requise)', async () => {
    await saveSession({
      accessToken: 'expired',
      refreshToken: 'revoked',
      expiresAt: Date.now() - 1000,
      role: 'basic',
    });
    mockRefreshAsync.mockRejectedValue(new Error('invalid_grant'));

    expect(await getValidSession()).toBeNull();
  });

  it('applique la marge de sécurité : un token qui expire dans 30s est traité comme expiré', async () => {
    await saveSession({
      accessToken: 'almost-dead',
      refreshToken: 'r',
      expiresAt: Date.now() + 30 * 1000, // expire dans 30s < marge de 60s
      role: 'basic',
    });
    mockRefreshAsync.mockResolvedValue({ accessToken: 'fresh', expiresIn: 3600 });

    const session = await getValidSession();
    expect(mockRefreshAsync).toHaveBeenCalled();
    expect(session?.accessToken).toBe('fresh');
  });
});
