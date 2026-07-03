# 🎵 SpotParty

Jeu de soirée mobile (iOS + Android) : chaque joueur ajoute des morceaux en
secret à une playlist commune, l'app les joue un par un, et tout le monde vote
pour deviner **qui a mis ce son**.

## Architecture (décisions actées)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Frontend | React Native + **Expo** (TypeScript) | Standard actuel, `expo prebuild` dispo si un module natif devient nécessaire |
| Temps réel | **Firebase Firestore** | Zéro serveur à héberger, listeners temps réel intégrés, reconnexion gérée |
| Auth Spotify | **OAuth 2.0 PKCE** via `expo-auth-session` | Recommandé pour mobile, pas de client secret dans l'app |
| Lecture audio | **API Web Spotify Connect** (`/me/player/*`) côté hôte | Le wrapper natif communautaire (`react-native-spotify-remote`) est abandonné depuis 2021 ; l'API Web pilote l'app Spotify officielle de l'hôte sans aucun code natif. Migration vers un module natif App Remote possible plus tard si besoin (le service `services/spotify/api.ts` isole cette logique). |

**Contrainte clé** : seul l'**hôte** a besoin de Spotify **Premium** (+ l'app
Spotify installée sur son téléphone). Les autres joueurs utilisent un compte
gratuit, uniquement pour chercher/ajouter des morceaux.

## Structure du projet

```
src/
  config/       # credentials & constantes (Spotify, Firebase)
  types/        # modèle de données (Room, Player, Track, Vote, Round…)
  services/
    spotify/    # auth PKCE, stockage tokens, client API Web
  context/      # état global React (AuthContext)
  hooks/        # hooks réutilisables (à venir)
  screens/      # un fichier par écran (Login, Home…)
  navigation/   # React Navigation (bascule auto Login ↔ app selon l'auth)
  components/   # composants UI réutilisables (à venir)
```

## Setup (à faire une fois)

### 1. Spotify Developer Dashboard

1. Va sur <https://developer.spotify.com/dashboard> et connecte-toi.
2. **Create app** — nom libre (ex: "SpotParty dev"), coche l'API **Web API**.
3. Dans **Settings → Redirect URIs**, ajoute exactement : `spotparty://auth`
4. Copie le **Client ID** (le Client Secret ne sert pas, PKCE s'en passe).
5. ⚠️ En "development mode", seuls 25 comptes testeurs peuvent se connecter :
   ajoute les emails de tes amis dans **User Management** du dashboard.

### 2. Firebase

1. <https://console.firebase.google.com> → **Créer un projet** (Analytics inutile).
2. **Firestore Database** → Créer → mode **test** pour commencer
   (⚠️ règles ouvertes 30 jours — on écrira de vraies Security Rules en Phase 6).
3. ⚙️ **Paramètres du projet → Vos applications → Ajouter une app Web** (`</>`),
   et copie les valeurs de `firebaseConfig`.

### 3. Variables d'environnement

```bash
cp .env.example .env
# puis remplis .env avec le Client ID Spotify et les clés Firebase
```

### 4. Lancer l'app

```bash
npm install
npx expo start
```

Scanne le QR code avec **Expo Go** (Android) ou l'appareil photo (iOS).

> **Note OAuth + Expo Go** : le redirect `spotparty://auth` nécessite que le
> scheme soit enregistré dans l'app. Dans Expo Go ce n'est pas le cas → pour
> tester la connexion Spotify sur téléphone, fais un **development build** :
> `npx expo run:android` (téléphone branché en USB, mode développeur activé)
> ou `npx expo run:ios` (Mac requis). C'est le même projet, juste compilé
> avec notre scheme. Tout le reste (UI, navigation) se teste très bien dans Expo Go.

## Avancement

- [x] **Phase 0 — Setup** : projet Expo TS, structure de dossiers, config Spotify/Firebase
- [x] **Phase 1 — Authentification** : OAuth PKCE (rôles `basic`/`host`), tokens en SecureStore, refresh silencieux, écran de profil + garde-fou "hôte non Premium"
- [x] **Phase 2 — Rooms temps réel** : créer une room (code 5 caractères), rejoindre via code (erreurs : introuvable / pleine / déjà commencée), lobby synchronisé en direct via Firestore, démarrage réservé à l'hôte (min. 2 joueurs), fermeture de la room si l'hôte part
- [ ] Phase 3 — Recherche & ajout de morceaux
- [ ] Phase 4 — Lecture (Spotify Connect) & votes
- [ ] Phase 5 — Reveal & scoring
- [ ] Phase 6 — Polish (erreurs, animations, security rules)
