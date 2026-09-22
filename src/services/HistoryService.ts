/**
 * @fileoverview HistoryService — Firestore persistence for advisor sessions.
 *
 * Path: /users/{uid}/sessions/{sessionId}. One document per conversation holds the transcript,
 * the drafted idea and the evaluation report, so History reads everything from a single
 * real-time query. Timestamps are client epoch-ms numbers, which sort correctly even while a
 * write is still pending offline (serverTimestamp() would read back as null until it syncs).
 */

import {
  FirestoreError,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import { DEFAULT_LANGUAGE, isLanguageCode } from "../i18n/languages";
import type { Session, SessionStage } from "../types/session";

const HISTORY_LIMIT = 50;
const STAGES: readonly SessionStage[] = ["chatting", "drafted", "evaluated"];

const sessionsRef = (uid: string) => collection(db, "users", uid, "sessions");

/** Allocate a document id locally, without a network round-trip. */
export function newSessionId(uid: string): string {
  return doc(sessionsRef(uid)).id;
}

export async function saveSession(uid: string, session: Session): Promise<void> {
  const { id, ...data } = session;
  await setDoc(doc(sessionsRef(uid), id), data);
}

export async function deleteSession(uid: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(sessionsRef(uid), sessionId));
}

/** Live list of the user's sessions, most recently updated first. */
export function subscribeToSessions(
  uid: string,
  onData: (sessions: Session[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(sessionsRef(uid), orderBy("updatedAt", "desc"), limit(HISTORY_LIMIT));
  return onSnapshot(q, (snapshot) => onData(snapshot.docs.map(fromSnapshot)), onError);
}

/** Live view of a single session; emits null if it does not exist (or was deleted). */
export function subscribeToSession(
  uid: string,
  sessionId: string,
  onData: (session: Session | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(sessionsRef(uid), sessionId),
    (snapshot) => onData(snapshot.exists() ? fromSnapshot(snapshot) : null),
    onError
  );
}

/** Defensive read: documents written by older builds may be missing fields. */
function fromSnapshot(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Session {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: typeof data.title === "string" ? data.title : "",
    language: isLanguageCode(data.language) ? data.language : DEFAULT_LANGUAGE,
    stage: STAGES.includes(data.stage) ? data.stage : "chatting",
    messages: Array.isArray(data.messages) ? data.messages : [],
    draft: data.draft ?? null,
    report: data.report ?? null,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}
