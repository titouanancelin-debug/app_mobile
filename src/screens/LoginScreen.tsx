/**
 * Écran de connexion
 * ==================
 *
 * Premier écran vu par un utilisateur déconnecté. Deux boutons :
 *  - "Je crée la partie (hôte)" → OAuth avec les scopes de lecture,
 *  - "Je rejoins une partie"    → OAuth avec les scopes minimum.
 *
 * (Version volontairement moche — le polish visuel viendra en Phase 6.)
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SpotifyRole } from '../types';

export default function LoginScreen() {
  const { signIn } = useAuth();
  // Mémorise quel bouton est en cours de chargement (ou null).
  const [loadingRole, setLoadingRole] = useState<SpotifyRole | null>(null);

  const handleSignIn = async (role: SpotifyRole) => {
    setLoadingRole(role);
    try {
      await signIn(role);
      // Pas de navigation à faire ici : quand le contexte passe à
      // "connecté", le navigateur (navigation/index.tsx) bascule tout
      // seul sur l'écran Home. C'est le pattern "auth flow" de React Navigation.
    } catch (err: any) {
      Alert.alert('Connexion impossible', err?.message ?? 'Erreur inconnue');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎵 SpotParty</Text>
      <Text style={styles.subtitle}>Devine qui a mis ce son.</Text>

      <Pressable
        style={[styles.button, styles.hostButton]}
        onPress={() => handleSignIn('host')}
        disabled={loadingRole !== null}
      >
        {loadingRole === 'host' ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Text style={styles.buttonText}>Je crée la partie (hôte)</Text>
            <Text style={styles.buttonHint}>Nécessite Spotify Premium — c'est ton téléphone qui jouera la musique</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={[styles.button, styles.guestButton]}
        onPress={() => handleSignIn('basic')}
        disabled={loadingRole !== null}
      >
        {loadingRole === 'basic' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={[styles.buttonText, { color: '#fff' }]}>Je rejoins une partie</Text>
            <Text style={[styles.buttonHint, { color: '#ccc' }]}>Un compte Spotify gratuit suffit</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// 📖 Concept — StyleSheet : l'équivalent du CSS en React Native, mais en
// objets JS. Pas de cascade ni de classes : chaque composant reçoit son
// style via la prop `style`. Flexbox est le système de layout par défaut.
const styles = StyleSheet.create({
  container: {
    flex: 1, // prend tout l'écran
    backgroundColor: '#191414', // le noir Spotify
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16, // espace vertical entre les enfants
  },
  title: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#aaa', marginBottom: 32 },
  button: {
    width: '100%',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  hostButton: { backgroundColor: '#1DB954' }, // le vert Spotify
  guestButton: { backgroundColor: '#333' },
  buttonText: { fontSize: 17, fontWeight: '600', color: '#000' },
  buttonHint: { fontSize: 12, color: '#0a0a0a', marginTop: 4, textAlign: 'center' },
});
