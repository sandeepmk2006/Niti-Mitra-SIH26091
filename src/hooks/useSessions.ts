/**
 * Real-time lists of the signed-in user's conversations and studies (History, Home).
 */

import { useCallback, useEffect, useState } from "react";
import type { FirestoreError, Unsubscribe } from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { subscribeToSessions, subscribeToStudies } from "../services/HistoryService";
import type { Session } from "../types/session";
import type { Study } from "../types/study";

function useLiveList<T>(
  subscribe: (uid: string, onData: (items: T[]) => void, onError: (e: FirestoreError) => void) => Unsubscribe,
  label: string
) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return subscribe(
      uid,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.warn(`[${label}] Subscription failed:`, err.code, err.message);
        setError(err);
        setLoading(false);
      }
    );
  }, [uid, attempt, subscribe, label]);

  /** Re-subscribe — a Firestore listener stops permanently after an error. */
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { items, loading, error, reload };
}

export function useSessions() {
  const { items, ...rest } = useLiveList<Session>(subscribeToSessions, "Conversations");
  return { sessions: items, ...rest };
}

export function useStudies() {
  const { items, ...rest } = useLiveList<Study>(subscribeToStudies, "Studies");
  return { studies: items, ...rest };
}
