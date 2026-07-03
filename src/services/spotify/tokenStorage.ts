/**
 * Stockage sécurisé des tokens Spotify
 * ====================================
 *
 * 📖 Concept — pourquoi pas un simple state React ?
 * Un state React disparaît quand on ferme l'app. On veut que l'utilisateur
 * reste connecté entre deux lancements → il faut persister les tokens.
 *
 * 📖 Concept — pourquoi SecureStore et pas AsyncStorage ?
 * AsyncStorage écrit en clair sur le disque. Un token Spotify donne accès
 * au compte de l'utilisateur : on le range donc dans expo-secure-store,
 * qui utilise le Keychain (iOS) / EncryptedSharedPreferences (Android),
 * chiffrés par l'OS.
 */
import * as SecureStore from 'expo-secure-store';
import { SpotifyRole } from '../../types';

/** Ce qu'on persiste après une connexion réussie. */
export interface StoredSession {
  accessToken: string;
  /** Sert à obtenir un nouvel accessToken sans redemander le login. */
  refreshToken: string;
  /** Timestamp ms au-delà duquel l'accessToken est périmé. */
  expiresAt: number;
  /** 'basic' ou 'host' — on s'en souvient pour savoir quels scopes on a. */
  role: SpotifyRole;
}

const KEY = 'spotify_session';

export async function saveSession(session: StoredSession): Promise<void> {
  // SecureStore ne stocke que des strings → on sérialise en JSON.
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    // Donnée corrompue (ne devrait pas arriver) : on repart de zéro.
    await SecureStore.deleteItemAsync(KEY);
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
