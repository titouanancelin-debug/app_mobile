/**
 * Hook useRoom — l'état temps réel d'une room, prêt à afficher
 * ============================================================
 *
 * 📖 Concept — un "custom hook" :
 * C'est juste une fonction qui utilise d'autres hooks (useState, useEffect)
 * pour empaqueter une logique réutilisable. Ici : "abonne-toi à la room X
 * et à ses joueurs, et donne-moi des states qui se mettent à jour tout seuls".
 * N'importe quel écran (Lobby aujourd'hui, écran de jeu demain) peut faire :
 *
 *   const { room, players, isLoading } = useRoom(code);
 *
 * et son UI se re-rend automatiquement à chaque changement dans Firestore.
 */
import { useEffect, useState } from 'react';
import { Room, Player } from '../types';
import { subscribeRoom, subscribePlayers } from '../services/rooms';

interface UseRoomResult {
  /** null = room fermée/inexistante (une fois isLoading passé à false). */
  room: Room | null;
  players: Player[];
  /** true tant que la première réponse de Firestore n'est pas arrivée. */
  isLoading: boolean;
}

export function useRoom(code: string): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Les deux abonnements démarrent quand l'écran apparaît…
    const unsubRoom = subscribeRoom(code, (r) => {
      setRoom(r);
      setIsLoading(false);
    });
    const unsubPlayers = subscribePlayers(code, setPlayers);

    // …et la fonction retournée par useEffect ("cleanup") les coupe
    // quand l'écran disparaît. Règle d'or : tout abonnement ouvert
    // dans un useEffect doit être fermé dans son cleanup.
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [code]); // si le code change (autre room), on ré-abonne proprement

  return { room, players, isLoading };
}
