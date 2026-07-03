/**
 * Écran d'accueil (une fois connecté)
 * ===================================
 *
 * Depuis la Phase 2, les boutons sont réels :
 *  - "Créer une room"   → crée le document Firestore et ouvre le lobby en hôte,
 *  - "Rejoindre"        → champ code + validation, puis ouvre le lobby.
 */
import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { createRoom, joinRoom, RoomError, PlayerIdentity } from '../services/rooms';
import { RootStackParamList } from '../navigation';

// Messages français pour chaque raison d'échec du join.
const JOIN_ERRORS: Record<string, string> = {
  'not-found': "Aucune room avec ce code. Vérifie l'orthographe !",
  'already-started': 'Cette partie a déjà commencé, tu ne peux plus la rejoindre.',
  full: 'Cette room est pleine (8 joueurs max).',
};

export default function HomeScreen() {
  const { profile, role, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  // L'identité qu'on écrit dans Firestore (l'id Spotify sert d'id joueur).
  const identity: PlayerIdentity | null = profile
    ? { id: profile.id, nickname: profile.displayName, avatarUrl: profile.avatarUrl }
    : null;

  const hostWithoutPremium = role === 'host' && profile?.product !== 'premium';

  const handleCreate = async () => {
    if (!identity) return;
    // Créer une room en étant connecté "joueur" est permis (pratique pour
    // tester), mais on prévient : la lecture Phase 4 exigera les scopes hôte.
    if (role !== 'host') {
      Alert.alert(
        'Connecté en joueur',
        "Tu peux créer la room, mais pour lancer la musique il faudra te reconnecter en hôte (bouton vert de l'écran de connexion)."
      );
    }
    setBusy('create');
    try {
      const code = await createRoom(identity);
      navigation.navigate('Lobby', { code });
    } catch (err: any) {
      Alert.alert('Création impossible', err?.message ?? 'Erreur inconnue');
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    if (!identity || !joinCode.trim()) return;
    setBusy('join');
    try {
      const code = joinCode.trim().toUpperCase();
      await joinRoom(code, identity);
      setJoinCode('');
      navigation.navigate('Lobby', { code });
    } catch (err: any) {
      const message =
        err instanceof RoomError ? JOIN_ERRORS[err.reason] : err?.message ?? 'Erreur inconnue';
      Alert.alert('Impossible de rejoindre', message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      {profile?.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{profile?.displayName?.[0] ?? '?'}</Text>
        </View>
      )}

      <Text style={styles.name}>{profile?.displayName}</Text>
      <Text style={styles.meta}>
        Rôle : {role === 'host' ? '🎧 Hôte' : '🙋 Joueur'} · Compte : {profile?.product}
      </Text>

      {hostWithoutPremium && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠️ Ton compte n'est pas Premium : tu pourras préparer une partie
            mais pas lancer la musique. Laisse un ami Premium être l'hôte.
          </Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={handleCreate} disabled={busy !== null}>
        {busy === 'create' ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Créer une room</Text>
        )}
      </Pressable>

      {/* Rejoindre : champ code + bouton sur la même ligne */}
      <View style={styles.joinRow}>
        <TextInput
          style={styles.input}
          placeholder="CODE"
          placeholderTextColor="#666"
          value={joinCode}
          onChangeText={setJoinCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={5}
        />
        <Pressable
          style={[styles.button, styles.joinButton, !joinCode.trim() && styles.disabled]}
          onPress={handleJoin}
          disabled={busy !== null || !joinCode.trim()}
        >
          {busy === 'join' ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Rejoindre</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 40, color: '#000', fontWeight: 'bold' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  meta: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  warning: { backgroundColor: '#5c3c00', borderRadius: 8, padding: 12 },
  warningText: { color: '#ffd479', fontSize: 13, lineHeight: 18 },
  button: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1DB954',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#000' },
  joinRow: { flexDirection: 'row', gap: 8, width: '100%' },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  joinButton: { width: undefined, flex: 1 },
  disabled: { opacity: 0.35 },
  logout: { marginTop: 24 },
  logoutText: { color: '#e05a5a', fontSize: 14 },
});
