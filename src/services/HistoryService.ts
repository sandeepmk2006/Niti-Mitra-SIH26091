/**
 * @fileoverview Firestore persistence for advisor conversations and feasibility studies.
 *
 *   /users/{uid}/sessions/{id} — advisor conversations
 *   /users/{uid}/studies/{id}  — feasibility studies
 *
 * Timestamps are client epoch-ms numbers, which sort correctly even while a write is still
 * pending offline (serverTimestamp() would read back as null until it syncs).
 */

import {
  DocumentSnapshot,
  FirestoreError,
  QueryDocumentSnapshot,
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
import type { Session } from "../types/session";
import type { Study } from "../types/study";

const HISTORY_LIMIT = 50;

type Kind = "sessions" | "studies";
const ref = (uid: string, kind: Kind) => collection(db, "users", uid, kind);

/** Allocate a document id locally, without a network round-trip. */
export function newDocumentId(uid: string, kind: Kind): string {
  return doc(ref(uid, kind)).id;
}

// ── Conversations ──

export async function saveSession(uid: string, session: Session): Promise<void> {
  const { id, ...data } = session;
  await setDoc(doc(ref(uid, "sessions"), id), data);
}

export async function deleteSession(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(ref(uid, "sessions"), id));
}

function sessionFrom(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Session {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    title: typeof data.title === "string" ? data.title : "",
    language: isLanguageCode(data.language) ? data.language : DEFAULT_LANGUAGE,
    messages: Array.isArray(data.messages) ? data.messages : [],
    studyId: typeof data.studyId === "string" ? data.studyId : null,
    studyTitle: typeof data.studyTitle === "string" ? data.studyTitle : null,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export function subscribeToSessions(
  uid: string,
  onData: (sessions: Session[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(ref(uid, "sessions"), orderBy("updatedAt", "desc"), limit(HISTORY_LIMIT));
  return onSnapshot(q, (s) => onData(s.docs.map(sessionFrom)), onError);
}

export function subscribeToSession(
  uid: string,
  id: string,
  onData: (session: Session | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(ref(uid, "sessions"), id),
    (s) => onData(s.exists() ? sessionFrom(s) : null),
    onError
  );
}

// ── Studies ──

export async function saveStudy(uid: string, study: Study): Promise<void> {
  const { id, ...data } = study;
  await setDoc(doc(ref(uid, "studies"), id), data);
}

export async function deleteStudy(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(ref(uid, "studies"), id));
}

/** Studies written by this app version always have plan/report/operations; skip anything else. */
function studyFrom(snapshot: QueryDocumentSnapshot | DocumentSnapshot): Study | null {
  const data = snapshot.data();
  if (!data?.plan || !data?.report || !data?.operations || !data?.input) return null;
  return {
    id: snapshot.id,
    language: isLanguageCode(data.language) ? data.language : DEFAULT_LANGUAGE,
    input: data.input,
    plan: data.plan,
    local: data.local ?? null,
    report: data.report,
    operations: data.operations,
    costBreakdown: Array.isArray(data.costBreakdown) ? data.costBreakdown : [],
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export function subscribeToStudies(
  uid: string,
  onData: (studies: Study[]) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(ref(uid, "studies"), orderBy("createdAt", "desc"), limit(HISTORY_LIMIT));
  return onSnapshot(
    q,
    (s) => onData(s.docs.map(studyFrom).filter((x): x is Study => x !== null)),
    onError
  );
}

export function subscribeToStudy(
  uid: string,
  id: string,
  onData: (study: Study | null) => void,
  onError: (error: FirestoreError) => void
): Unsubscribe {
  return onSnapshot(
    doc(ref(uid, "studies"), id),
    (s) => onData(s.exists() ? studyFrom(s) : null),
    onError
  );
}
