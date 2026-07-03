/**
 * Écran Lobby
 * ===========
 *
 * La salle d'attente avant la partie. Tout ici est TEMPS RÉEL grâce au
 * hook useRoom : quand un ami rejoint sur son téléphone, la liste se met
 * à jour sur tous les autres sans rien faire.
 *
 * Comportements :
 *  - le code de la room s'affiche en gros (à crier / partager),
 *  - l'hôte voit le bouton "Démarrer" (actif à partir de 2 joueurs),
 *  - si l'hôte part, la room est supprimée → tous les abonnés reçoivent
 *    room=null et sont ramenés à l'accueil avec un message,
 *  - quand la phase passe à "picking", l'écran bascule (placeholder Phase 3).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useAuth } from '../context/AuthContext';
import { useRoom } from '../hooks/useRoom';
import { leaveRoom, startGame, MIN_PLAYERS_TO_START } from '../services/rooms';
import { Player } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ route, navigation }: Props) {
  const { code } = route.params;
  const { profile } = useAuth();
  const { room, players, isLoading } = useRoom(code);
  // true pendant qu'on quitte volontairement : évite d'afficher l'alerte
  // "room fermée" à celui qui vient justement de la fermer.
  const [leaving, setLeaving] = useState(false);

  const isHost = room?.hostId === profile?.id;
  const canStart = (room?.playerCount ?? 0) >= MIN_PLAYERS_TO_START;

  // Room disparue (hôte parti) alors qu'on est encore sur l'écran → retour accueil.
  useEffect(() => {
    if (!isLoading && room === null && !leaving) {
      Alert.alert('Room fermée', "L'hôte a quitté la partie.");
      navigation.popToTop();
    }
  }, [isLoading, room, leaving, navigation]);

  const handleLeave = async () => {
    if (!profile) return;
    setLeaving(true);
    try {
      await leaveRoom(code, profile.id);
    } finally {
      navigation.popToTop();
    }
  };

  const handleStart = async () => {
    try {
      await startGame(code);
      // Pas de navigation manuelle : le changement de phase arrive par
      // l'abonnement Firestore, sur TOUS les téléphones en même temps.
    } catch (err: any) {
      Alert.alert('Impossible de démarrer', err?.message ?? 'Erreur inconnue');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  // Phase suivante : placeholder en attendant la Phase 3 (ajout des morceaux).
  if (room && room.phase !== 'lobby') {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={styles.title}>🎶 C'est parti !</Text>
        <Text style={styles.subtitle}>
          Prochaine étape (Phase 3) : chacun ajoute ses {room.tracksPerPlayer} morceaux en secret…
        </Text>
        <Pressable style={styles.leave} onPress={handleLeave}>
          <Text style={styles.leaveText}>Quitter la partie</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Code de la room</Text>
      {/* selectable : appui long pour copier/partager le code */}
      <Text style={styles.code} selectable>{code}</Text>

      <Text style={styles.label}>
        Joueurs ({room?.playerCount ?? 0}/8)
      </Text>
      <FlatList
        style={styles.list}
        data={players}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlayerRow player={item} />}
      />

      {isHost ? (
        <>
          {!canStart && (
            <Text style={styles.hint}>
              Il faut au moins {MIN_PLAYERS_TO_START} joueurs pour démarrer.
            </Text>
          )}
          <Pressable
            style={[styles.button, !canStart && styles.disabled]}
            onPress={handleStart}
            disabled={!canStart}
          >
            <Text style={styles.buttonText}>Démarrer la partie</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>En attente du lancement par l'hôte…</Text>
      )}

      <Pressable style={styles.leave} onPress={handleLeave}>
        <Text style={styles.leaveText}>
          {isHost ? 'Fermer la room' : 'Quitter la room'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Une ligne de la liste des joueurs : avatar + pseudo + badge hôte. */
function PlayerRow({ player }: { player: Player }) {
  return (
    <View style={styles.playerRow}>
      {player.avatarUrl ? (
        <Image source={{ uri: player.avatarUrl }} style={styles.playerAvatar} />
      ) : (
        <View style={[styles.playerAvatar, styles.playerAvatarFallback]}>
          <Text style={styles.playerAvatarLetter}>{player.nickname[0] ?? '?'}</Text>
        </View>
      )}
      <Text style={styles.playerName}>{player.nickname}</Text>
      {player.isHost && <Text style={styles.hostBadge}>🎧 hôte</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191414', padding: 24, paddingTop: 72, gap: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#aaa', textAlign: 'center', marginTop: 8 },
  label: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  code: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#1DB954',
    letterSpacing: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  list: { flexGrow: 0, marginBottom: 16 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  playerAvatar: { width: 40, height: 40, borderRadius: 20 },
  playerAvatarFallback: { backgroundColor: '#444', alignItems: 'center', justifyContent: 'center' },
  playerAvatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  playerName: { color: '#fff', fontSize: 16, flex: 1 },
  hostBadge: { color: '#1DB954', fontSize: 13 },
  hint: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  button: { borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: '#1DB954' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#000' },
  disabled: { opacity: 0.35 },
  leave: { alignItems: 'center', padding: 12 },
  leaveText: { color: '#e05a5a', fontSize: 14 },
});
