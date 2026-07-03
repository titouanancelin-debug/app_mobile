/**
 * Navigation de l'app
 * ===================
 *
 * 📖 Concept — le pattern "auth flow" de React Navigation :
 * On ne "navigue" jamais manuellement entre Login et Home. À la place,
 * on déclare CONDITIONNELLEMENT les écrans selon l'état d'auth :
 *   - déconnecté → seul l'écran Login existe,
 *   - connecté   → seul l'écran Home existe (+ les futurs écrans de jeu).
 * Quand l'état change (signIn/signOut), React Navigation fait la
 * transition automatiquement. Impossible de se retrouver sur un écran
 * de jeu sans être connecté.
 */
import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import LobbyScreen from '../screens/LobbyScreen';

// Liste des écrans et de leurs paramètres.
// TypeScript s'en servira pour vérifier nos appels navigation.navigate() :
// impossible d'ouvrir le Lobby sans lui passer un code de room, par exemple.
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Lobby: { code: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isLoading, profile } = useAuth();

  // Pendant la restauration de session au démarrage : un simple spinner.
  // (Évite un "flash" de l'écran Login chez un utilisateur déjà connecté.)
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#191414', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {profile ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            {/* gestureEnabled:false : on ne quitte pas une room d'un swipe
                accidentel — il y a un bouton "Quitter" explicite pour ça. */}
            <Stack.Screen name="Lobby" component={LobbyScreen} options={{ gestureEnabled: false }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
