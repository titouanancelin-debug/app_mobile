/**
 * Point d'entrée de l'app
 * =======================
 *
 * On garde ce fichier minimal : il empile les "providers" (les contextes
 * globaux) autour du navigateur. Ordre : AuthProvider doit englober
 * AppNavigator, car la navigation dépend de l'état d'authentification.
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      {/* style="light" = texte de la barre de statut en blanc (fond sombre) */}
      <StatusBar style="light" />
      <AppNavigator />
    </AuthProvider>
  );
}
