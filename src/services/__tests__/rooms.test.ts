/**
 * Tests du service de rooms
 * =========================
 *
 * On ne parle pas au vrai Firestore (il faudrait un réseau et un projet
 * Firebase). À la place, on mocke le module 'firebase/firestore' avec une
 * mini-base en mémoire (une Map "chemin → document"). Ça permet de tester
 * toute NOTRE logique : codes, compteur de joueurs, règles de join,
 * fermeture par l'hôte… sans dépendance externe.
 */
import {
  generateRoomCode,
  createRoom,
  joinRoom,
  leaveRoom,
  RoomError,
  MAX_PLAYERS,
  PlayerIdentity,
} from '../rooms';
import { Room } from '../../types';

// Notre "base de données" en mémoire. (Le préfixe "mock" est obligatoire
// pour que Jest autorise son usage dans les factories jest.mock ci-dessous.)
const mockStore = new Map<string, any>();

jest.mock('../../config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  // Une référence de document/collection = juste son chemin.
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),

  // Version simplifiée d'une transaction : pas de concurrence dans les
  // tests, donc get/set/update/delete agissent directement sur la Map.
  runTransaction: async (_db: unknown, fn: (tx: any) => Promise<any>) =>
    fn({
      get: async (ref: any) => ({
        exists: () => mockStore.has(ref.path),
        data: () => mockStore.get(ref.path),
      }),
      set: (ref: any, data: any) => mockStore.set(ref.path, data),
      update: (ref: any, data: any) =>
        mockStore.set(ref.path, { ...mockStore.get(ref.path), ...data }),
      delete: (ref: any) => mockStore.delete(ref.path),
    }),

  updateDoc: async (ref: any, data: any) =>
    mockStore.set(ref.path, { ...mockStore.get(ref.path), ...data }),

  getDocs: async (col: any) => {
    const docs = [...mockStore.entries()]
      .filter(([path]) => path.startsWith(col.path + '/'))
      .map(([path, data]) => ({ ref: { path }, data: () => data }));
    return { docs, forEach: (cb: (d: any) => void) => docs.forEach(cb) };
  },

  writeBatch: () => {
    const ops: Array<() => void> = [];
    return {
      delete: (ref: any) => ops.push(() => mockStore.delete(ref.path)),
      commit: async () => ops.forEach((op) => op()),
    };
  },

  // Non utilisés dans ces tests (temps réel) :
  onSnapshot: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
}));

const alice: PlayerIdentity = { id: 'alice', nickname: 'Alice', avatarUrl: null };
const bob: PlayerIdentity = { id: 'bob', nickname: 'Bob', avatarUrl: 'https://img/bob.jpg' };

const getRoom = (code: string) => mockStore.get(`rooms/${code}`) as Room | undefined;

describe('generateRoomCode', () => {
  it('produit 5 caractères sans lettres/chiffres ambigus (O, 0, I, 1, L…)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(5);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    }
  });
});

describe('createRoom', () => {
  beforeEach(() => mockStore.clear());

  it('crée la room en phase lobby avec le créateur comme hôte', async () => {
    const code = await createRoom(alice);

    const room = getRoom(code)!;
    expect(room.phase).toBe('lobby');
    expect(room.hostId).toBe('alice');
    expect(room.playerCount).toBe(1);

    const hostPlayer = mockStore.get(`rooms/${code}/players/alice`);
    expect(hostPlayer.isHost).toBe(true);
    expect(hostPlayer.score).toBe(0);
  });
});

describe('joinRoom', () => {
  let code: string;
  beforeEach(async () => {
    mockStore.clear();
    code = await createRoom(alice);
  });

  it('ajoute le joueur et incrémente le compteur', async () => {
    await joinRoom(code, bob);

    expect(getRoom(code)!.playerCount).toBe(2);
    const player = mockStore.get(`rooms/${code}/players/bob`);
    expect(player.isHost).toBe(false);
    expect(player.nickname).toBe('Bob');
  });

  it('normalise le code (minuscules, espaces) avant de chercher la room', async () => {
    await joinRoom(`  ${code.toLowerCase()} `, bob);
    expect(getRoom(code)!.playerCount).toBe(2);
  });

  it("refuse un code qui n'existe pas", async () => {
    await expect(joinRoom('ZZZZZ', bob)).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('refuse de rejoindre une partie déjà commencée', async () => {
    mockStore.set(`rooms/${code}`, { ...getRoom(code), phase: 'playing' });
    await expect(joinRoom(code, bob)).rejects.toThrow(RoomError);
    await expect(joinRoom(code, bob)).rejects.toMatchObject({ reason: 'already-started' });
  });

  it('refuse quand la room est pleine', async () => {
    mockStore.set(`rooms/${code}`, { ...getRoom(code), playerCount: MAX_PLAYERS });
    await expect(joinRoom(code, bob)).rejects.toMatchObject({ reason: 'full' });
  });

  it('re-rejoindre est sans effet (pas de double comptage après relance de l’app)', async () => {
    await joinRoom(code, bob);
    await joinRoom(code, bob); // deuxième join du même joueur
    expect(getRoom(code)!.playerCount).toBe(2); // pas 3 !
  });
});

describe('leaveRoom', () => {
  let code: string;
  beforeEach(async () => {
    mockStore.clear();
    code = await createRoom(alice);
    await joinRoom(code, bob);
  });

  it('un joueur normal part : il est retiré, la room continue', async () => {
    await leaveRoom(code, 'bob');

    expect(getRoom(code)!.playerCount).toBe(1);
    expect(mockStore.has(`rooms/${code}/players/bob`)).toBe(false);
    expect(mockStore.has(`rooms/${code}/players/alice`)).toBe(true);
  });

  it("l'HÔTE part : la room et tous ses joueurs sont supprimés", async () => {
    await leaveRoom(code, 'alice');

    expect(getRoom(code)).toBeUndefined();
    expect(mockStore.has(`rooms/${code}/players/alice`)).toBe(false);
    expect(mockStore.has(`rooms/${code}/players/bob`)).toBe(false);
  });

  it('quitter une room déjà fermée ne plante pas', async () => {
    await leaveRoom(code, 'alice'); // ferme tout
    await expect(leaveRoom(code, 'bob')).resolves.toBeUndefined();
  });
});
