/**
 * Real-time list of the signed-in user's sessions (History and Home both read this).
 */

import { useCallback, useEffect, useState } from "react";
import type { FirestoreError } from "firebase/firestore";

import { useAuth } from "../context/AuthContext";
import { subscribeToSessions } from "../services/HistoryService";
import type { Session } from "../types/session";

export function useSessions() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    return subscribeToSessions(
      uid,
      (list) => {
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[History] Subscription failed:", err.code, err.message);
        setError(err);
        setLoading(false);
      }
    );
  }, [uid, attempt]);

  /** Re-subscribe — a Firestore listener stops permanently after an error. */
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { sessions, loading, error, reload };
}
