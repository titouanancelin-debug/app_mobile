/**
 * Écran d'accueil (une fois connecté)
 * ===================================
 *
 * Pour l'instant (fin de Phase 1) il sert surtout à VÉRIFIER que l'auth
 * fonctionne : il affiche le profil Spotify récupéré via l'API, le rôle
 * choisi, et un avertissement si un hôte n'est pas Premium.
 *
 * En Phase 2, les boutons "Créer une room" / "Rejoindre" deviendront réels.
 */
import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { profile, role, signOut } = useAuth();

  // Le garde-fou demandé : un hôte sans Premium ne pourra pas lancer la
  // musique (l'API de lecture renvoie une erreur 403). Autant le lui dire
  // tout de suite plutôt qu'au moment de démarrer la partie.
  const hostWithoutPremium = role === 'host' && profile?.product !== 'premium';

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
            ⚠️ Ton compte n'est pas Premium. Tu peux préparer une partie, mais
            Spotify refusera de lancer la lecture. Passe Premium ou laisse un
            ami Premium être l'hôte.
          </Text>
        </View>
      )}

      {/* Placeholders Phase 2 — désactivés pour l'instant */}
      <Pressable style={[styles.button, styles.disabled]} disabled>
        <Text style={styles.buttonText}>Créer une room (Phase 2)</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.disabled]} disabled>
        <Text style={styles.buttonText}>Rejoindre une room (Phase 2)</Text>
      </Pressable>

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
  button: { width: '100%', borderRadius: 12, padding: 16, alignItems: 'center', backgroundColor: '#1DB954' },
  disabled: { opacity: 0.35 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#000' },
  logout: { marginTop: 24 },
  logoutText: { color: '#e05a5a', fontSize: 14 },
});
