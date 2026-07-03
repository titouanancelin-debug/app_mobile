/**
 * Tests de tokenStorage
 * =====================
 *
 * 📖 Concept — le "mock" :
 * expo-secure-store parle au Keychain du téléphone… qui n'existe pas dans
 * un environnement de test Node. On le remplace donc par un faux ("mock")
 * qui stocke tout dans un simple objet JS en mémoire. jest.mock() intercepte
 * l'import : quand tokenStorage.ts fait `import * as SecureStore`, il reçoit
 * notre faux sans le savoir.
 */
import { saveSession, loadSession, clearSession, StoredSession } from '../tokenStorage';
import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

const fakeSession: StoredSession = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  expiresAt: 1750000000000,
  role: 'host',
};

describe('tokenStorage', () => {
  beforeEach(async () => {
    await clearSession(); // chaque test part d'un stockage vide
  });

  it('sauvegarde puis recharge une session à l’identique', async () => {
    await saveSession(fakeSession);
    const loaded = await loadSession();
    expect(loaded).toEqual(fakeSession);
  });

  it('retourne null quand rien n’est stocké', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('efface bien la session', async () => {
    await saveSession(fakeSession);
    await clearSession();
    expect(await loadSession()).toBeNull();
  });

  it('purge le stockage si la donnée est corrompue (JSON invalide)', async () => {
    // On écrit directement du JSON cassé, comme si le stockage était corrompu.
    await SecureStore.setItemAsync('spotify_session', '{pas du json');
    expect(await loadSession()).toBeNull();
    // Et la donnée corrompue doit avoir été supprimée au passage.
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('spotify_session');
  });
});
