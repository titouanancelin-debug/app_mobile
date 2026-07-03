/**
 * Contexte d'authentification
 * ===========================
 *
 * 📖 Concept — le Context React :
 * Beaucoup d'écrans ont besoin de savoir "qui est connecté ?" (profil,
 * rôle hôte ou pas, etc.). Plutôt que de passer ces infos de composant
 * en composant via les props ("prop drilling"), on les met dans un
 * Context : un état global que n'importe quel composant peut lire avec
 * le hook useAuth() défini en bas de ce fichier.
 *
 * Ce contexte orchestre les services de src/services/spotify :
 *  - au démarrage de l'app : restaure la session stockée (si elle existe),
 *  - signIn(role) : lance le flux OAuth puis charge le profil,
 *  - signOut() : efface tout.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SpotifyProfile, SpotifyRole } from '../types';
import { authorize, getValidSession } from '../services/spotify/auth';
import { clearSession } from '../services/spotify/tokenStorage';
import { getMyProfile } from '../services/spotify/api';

interface AuthState {
  /** true tant qu'on n'a pas fini de restaurer la session au démarrage. */
  isLoading: boolean;
  /** Profil Spotify de l'utilisateur connecté, ou null si déconnecté. */
  profile: SpotifyProfile | null;
  /** Rôle choisi à la connexion ('basic' | 'host'), ou null si déconnecté. */
  role: SpotifyRole | null;
  /** Lance la connexion Spotify. Retourne true si elle a abouti. */
  signIn: (role: SpotifyRole) => Promise<boolean>;
  signOut: () => Promise<void>;
}

// La valeur par défaut n'est jamais utilisée en pratique (le Provider
// englobe toute l'app), mais TypeScript exige d'en fournir une.
const AuthContext = createContext<AuthState>({
  isLoading: true,
  profile: null,
  role: null,
  signIn: async () => false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [role, setRole] = useState<SpotifyRole | null>(null);

  // Au montage (= au lancement de l'app) : y a-t-il une session stockée ?
  useEffect(() => {
    (async () => {
      try {
        const session = await getValidSession(); // rafraîchit le token si besoin
        if (session) {
          setProfile(await getMyProfile());
          setRole(session.role);
        }
      } catch {
        // Session inutilisable (réseau coupé, token révoqué…) :
        // on démarre déconnecté, l'utilisateur pourra se reconnecter.
      } finally {
        setIsLoading(false); // dans tous les cas, on quitte l'écran de chargement
      }
    })();
  }, []);

  const signIn = async (chosenRole: SpotifyRole): Promise<boolean> => {
    const session = await authorize(chosenRole);
    if (!session) return false; // l'utilisateur a annulé
    setProfile(await getMyProfile());
    setRole(chosenRole);
    return true;
  };

  const signOut = async () => {
    await clearSession();
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ isLoading, profile, role, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Le hook que les écrans utilisent : const { profile, signIn } = useAuth(); */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
