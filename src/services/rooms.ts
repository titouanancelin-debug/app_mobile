/**
 * Service des rooms (Firestore)
 * =============================
 *
 * Tout ce qui touche au cycle de vie d'une room passe par ici :
 * création, join, départ, démarrage, et surtout les ABONNEMENTS temps réel.
 *
 * 📖 Concept — onSnapshot, le cœur du "temps réel" :
 * Au lieu de demander "donne-moi la room" (requête ponctuelle), on dit
 * "préviens-moi À CHAQUE FOIS que la room change". Firestore garde une
 * connexion ouverte et pousse les mises à jour vers tous les téléphones
 * abonnés en ~100 ms. C'est ce qui fait que le lobby se met à jour tout
 * seul quand un ami rejoint.
 *
 * 📖 Concept — les transactions :
 * Deux amis tapent le code en même temps alors qu'il ne reste qu'une place.
 * Sans précaution, les deux liraient "7/8 joueurs" et entreraient tous les
 * deux. runTransaction garantit que lecture + écriture forment un bloc
 * atomique : si quelqu'un d'autre a modifié la room entre-temps, Firestore
 * rejoue automatiquement la transaction avec les données fraîches.
 */
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  runTransaction,
  updateDoc,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Room, Player } from '../types';

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS_TO_START = 2; // 3+ conseillé pour le fun, 2 pour tester

/** Erreur typée : les écrans mappent `reason` vers un message français. */
export class RoomError extends Error {
  constructor(public reason: 'not-found' | 'already-started' | 'full') {
    super(`Room error: ${reason}`);
    this.name = 'RoomError';
  }
}

/** Ce qu'il faut savoir d'un utilisateur pour le faire entrer dans une room. */
export interface PlayerIdentity {
  id: string; // l'id Spotify — stable et unique
  nickname: string;
  avatarUrl: string | null;
}

/**
 * Génère un code de room à 5 caractères, ex: "K7F3Q".
 * L'alphabet exclut les caractères ambigus à l'oral ou à l'écrit
 * (O/0, I/1/L…) — c'est un code qu'on se crie à travers le salon !
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateRoomCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Construit le document Player initial d'un arrivant. */
function newPlayer(identity: PlayerIdentity, isHost: boolean): Player {
  return {
    id: identity.id,
    nickname: identity.nickname,
    avatarUrl: identity.avatarUrl,
    isHost,
    score: 0,
    isReady: false,
    joinedAt: Date.now(),
  };
}

/**
 * Crée une room et y installe le créateur comme hôte.
 * Retourne le code à partager aux amis.
 */
export async function createRoom(host: PlayerIdentity): Promise<string> {
  // En cas de (très improbable) collision de code, on retente avec un autre.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const created = await runTransaction(db, async (tx) => {
      const roomRef = doc(db, 'rooms', code);
      const existing = await tx.get(roomRef);
      if (existing.exists()) return false; // collision → nouveau tour de boucle

      const room: Room = {
        code,
        hostId: host.id,
        phase: 'lobby',
        currentRound: null,
        tracksPerPlayer: 2,
        playerCount: 1,
        createdAt: Date.now(),
      };
      tx.set(roomRef, room);
      tx.set(doc(db, 'rooms', code, 'players', host.id), newPlayer(host, true));
      return true;
    });
    if (created) return code;
  }
  throw new Error('Impossible de générer un code de room unique (réessaie).');
}

/**
 * Rejoint une room existante via son code.
 * Lève une RoomError('not-found' | 'already-started' | 'full') sinon.
 */
export async function joinRoom(code: string, player: PlayerIdentity): Promise<void> {
  const normalized = code.trim().toUpperCase();
  await runTransaction(db, async (tx) => {
    const roomRef = doc(db, 'rooms', normalized);
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new RoomError('not-found');

    const room = roomSnap.data() as Room;
    if (room.phase !== 'lobby') throw new RoomError('already-started');

    // Déjà dans la room (ex: l'app a été relancée) → rien à faire,
    // et surtout ne pas incrémenter playerCount une deuxième fois.
    const playerRef = doc(db, 'rooms', normalized, 'players', player.id);
    const playerSnap = await tx.get(playerRef);
    if (playerSnap.exists()) return;

    if (room.playerCount >= MAX_PLAYERS) throw new RoomError('full');

    tx.set(playerRef, newPlayer(player, false));
    tx.update(roomRef, { playerCount: room.playerCount + 1 });
  });
}

/**
 * Quitte la room.
 * Cas particulier : si c'est L'HÔTE qui part, la room ferme pour tout le
 * monde (c'est son téléphone qui devait jouer la musique — sans lui, pas
 * de partie). Les autres joueurs verront la room disparaître via leur
 * abonnement et seront ramenés à l'accueil.
 */
export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', code);

  // On lit la room une première fois pour savoir si c'est l'hôte qui part.
  let isHostLeaving = false;
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) return; // room déjà fermée : rien à faire

    const room = roomSnap.data() as Room;
    if (room.hostId === playerId) {
      isHostLeaving = true; // suppression complète gérée hors transaction
      return;
    }
    tx.delete(doc(db, 'rooms', code, 'players', playerId));
    tx.update(roomRef, { playerCount: Math.max(0, room.playerCount - 1) });
  });

  if (isHostLeaving) {
    // Supprimer une room = supprimer aussi sa sous-collection players
    // (Firestore ne supprime PAS les sous-collections automatiquement).
    const playersSnap = await getDocs(collection(db, 'rooms', code, 'players'));
    const batch = writeBatch(db);
    playersSnap.forEach((p) => batch.delete(p.ref));
    batch.delete(roomRef);
    await batch.commit();
  }
}

/** L'hôte lance la partie : tout le monde passe en phase "ajout des morceaux". */
export async function startGame(code: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', code), { phase: 'picking' });
}

/**
 * S'abonne aux changements de la room.
 * `callback(null)` signifie que la room n'existe plus (fermée par l'hôte).
 * Retourne une fonction de désabonnement — à appeler quand l'écran se ferme,
 * sinon on garde une connexion ouverte pour rien ("memory leak").
 */
export function subscribeRoom(code: string, callback: (room: Room | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'rooms', code), (snap) => {
    callback(snap.exists() ? (snap.data() as Room) : null);
  });
}

/** S'abonne à la liste des joueurs, triée par ordre d'arrivée. */
export function subscribePlayers(code: string, callback: (players: Player[]) => void): Unsubscribe {
  const q = query(collection(db, 'rooms', code, 'players'), orderBy('joinedAt'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as Player));
  });
}
