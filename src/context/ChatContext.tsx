/**
 * @fileoverview ChatContext — the active advisor conversation.
 *
 * Lives above the tab navigator so the conversation survives tab switches, and mirrors every
 * change to Firestore so History updates in real time and a conversation can be resumed later.
 * A conversation can be linked to a feasibility study (opened from a report); the advisor then
 * answers with that report as context.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

import { useAuth } from "./AuthContext";
import { useI18n, TranslateFn } from "../i18n/I18nContext";
import type { LanguageCode } from "../i18n/languages";
import { getAdvisorReply } from "../services/AdvisorService";
import { newDocumentId, saveSession } from "../services/HistoryService";
import type { ChatMessage, Session } from "../types/session";
import type { Study } from "../types/study";

interface ActiveSession {
  /** Null until the first message is sent — nothing is written to Firestore before that. */
  id: string | null;
  title: string;
  language: LanguageCode;
  messages: ChatMessage[];
  study: Study | null;
  studyTitle: string | null;
  createdAt: number;
}

interface ChatContextValue {
  sessionId: string | null;
  messages: ChatMessage[];
  /** The opening advisor message to show before anything has been sent. */
  intro: ChatMessage;
  linkedStudyTitle: string | null;
  busy: boolean;
  error: boolean;
  hasConversation: boolean;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  startNewChat: () => void;
  /** Start a fresh conversation about a study (from its report screen). */
  startChatAboutStudy: (study: Study, title: string) => void;
  resumeSession: (session: Session, study: Study | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const TITLE_MAX_LENGTH = 60;

function emptySession(language: LanguageCode): ActiveSession {
  return { id: null, title: "", language, messages: [], study: null, studyTitle: null, createdAt: 0 };
}

function makeMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The fixed, translated opening turn — generic, or about a linked study. */
export function buildIntroMessage(t: TranslateFn, studyTitle: string | null): ChatMessage {
  const option = (key: string) => ({
    label: t(`${key}` as never),
    description: t(`${key}d` as never),
  });
  return studyTitle
    ? {
        id: "intro",
        role: "assistant",
        text: t("advisor.studyIntro", { title: studyTitle }),
        createdAt: Date.now(),
        question: {
          text: t("advisor.introQ"),
          options: ["advisor.s1", "advisor.s2", "advisor.s3", "advisor.s4"].map(option),
        },
      }
    : {
        id: "intro",
        role: "assistant",
        text: t("advisor.intro"),
        createdAt: Date.now(),
        question: {
          text: t("advisor.introQ"),
          options: ["advisor.q1", "advisor.q2", "advisor.q3", "advisor.q4"].map(option),
        },
      };
}

function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.text.trim() ?? "";
  return first.length > TITLE_MAX_LENGTH ? `${first.slice(0, TITLE_MAX_LENGTH - 1)}…` : first;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { language, t } = useI18n();

  const [session, setSession] = useState<ActiveSession>(() => emptySession(language));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Async replies read the latest session through this ref so a late Gemini response can tell
  // whether the user has since moved on to a different conversation.
  const sessionRef = useRef(session);
  const busyRef = useRef(false);

  const uid = user?.uid ?? null;

  const replace = useCallback((next: ActiveSession) => {
    sessionRef.current = next;
    setSession(next);
    setError(false);
    busyRef.current = false;
    setBusy(false);
  }, []);

  const commit = useCallback(
    (next: ActiveSession) => {
      sessionRef.current = next;
      setSession(next);
      if (!uid || !next.id) return;
      saveSession(uid, {
        id: next.id,
        title: next.title,
        language: next.language,
        messages: next.messages,
        studyId: next.study?.id ?? null,
        studyTitle: next.studyTitle,
        createdAt: next.createdAt,
        updatedAt: Date.now(),
      }).catch((err) => console.warn("[Chat] Failed to save conversation:", err));
    },
    [uid]
  );

  const startNewChat = useCallback(() => replace(emptySession(language)), [language, replace]);

  const startChatAboutStudy = useCallback(
    (study: Study, title: string) => replace({ ...emptySession(language), study, studyTitle: title }),
    [language, replace]
  );

  const resumeSession = useCallback(
    (saved: Session, study: Study | null) =>
      replace({
        id: saved.id,
        title: saved.title,
        language: saved.language,
        messages: saved.messages,
        study,
        studyTitle: saved.studyTitle,
        createdAt: saved.createdAt,
      }),
    [replace]
  );

  // A different (or no) signed-in user must never see the previous user's conversation.
  useEffect(() => {
    startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const requestReply = useCallback(
    async (snapshot: ActiveSession) => {
      busyRef.current = true;
      setBusy(true);
      setError(false);
      try {
        const turn = await getAdvisorReply(snapshot.messages, {
          language: snapshot.language,
          fullName: user?.fullName,
          preferences: user?.preferences ?? null,
          study: snapshot.study,
        });
        if (sessionRef.current.id !== snapshot.id) return;
        const current = sessionRef.current;
        commit({
          ...current,
          messages: [
            ...current.messages,
            { id: makeMessageId(), role: "assistant", text: turn.message, question: turn.question, createdAt: Date.now() },
          ],
        });
      } catch (err) {
        console.warn("[Chat] Reply failed:", err);
        if (sessionRef.current.id === snapshot.id) setError(true);
      } finally {
        if (sessionRef.current.id === snapshot.id) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [commit, user?.fullName, user?.preferences]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const current = sessionRef.current;
      if (!trimmed || busyRef.current) return;

      const isNew = current.id === null;
      const messages: ChatMessage[] = [
        ...(isNew ? [buildIntroMessage(t, current.studyTitle)] : current.messages),
        { id: makeMessageId(), role: "user", text: trimmed, createdAt: Date.now() },
      ];
      const next: ActiveSession = {
        ...current,
        id: current.id ?? (uid ? newDocumentId(uid, "sessions") : `local-${makeMessageId()}`),
        createdAt: isNew ? Date.now() : current.createdAt,
        language: isNew ? language : current.language,
        title: current.title || current.studyTitle || titleFrom(messages),
        messages,
      };
      commit(next);
      await requestReply(next);
    },
    [commit, language, requestReply, t, uid]
  );

  const retry = useCallback(async () => {
    if (error) await requestReply(sessionRef.current);
  }, [error, requestReply]);

  const intro = useMemo(() => buildIntroMessage(t, session.studyTitle), [t, session.studyTitle]);

  const value = useMemo<ChatContextValue>(
    () => ({
      sessionId: session.id,
      messages: session.messages,
      intro,
      linkedStudyTitle: session.studyTitle,
      busy,
      error,
      hasConversation: session.messages.length > 0,
      sendMessage,
      retry,
      startNewChat,
      startChatAboutStudy,
      resumeSession,
    }),
    [session, intro, busy, error, sendMessage, retry, startNewChat, startChatAboutStudy, resumeSession]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used inside <ChatProvider>");
  }
  return context;
}
