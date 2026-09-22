/**
 * @fileoverview ChatContext — state for the Evaluate tab's chat → draft → evaluation flow.
 *
 * Lives above the tab navigator so the conversation survives tab switches, and mirrors every
 * change to Firestore (HistoryService) so History updates in real time and a session can be
 * resumed later. Stages:
 *
 *   chatting ──Evaluate──▶ drafted ──Proceed──▶ evaluated
 *       ▲                     │
 *       └──── Refine ─────────┘
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
import {
  AdvisorContext,
  draftIdea,
  evaluateIdea,
  getChatReply,
} from "../services/AdvisorService";
import { newSessionId, saveSession } from "../services/HistoryService";
import type {
  ChatMessage,
  EvaluationReport,
  IdeaDraft,
  Session,
  SessionStage,
} from "../types/session";

export type ChatBusyState = "replying" | "drafting" | "evaluating" | null;
export type ChatErrorState = "reply" | "draft" | "evaluate" | null;

interface ActiveSession {
  /** Null until the first message is sent — nothing is written to Firestore before that. */
  id: string | null;
  title: string;
  language: LanguageCode;
  stage: SessionStage;
  messages: ChatMessage[];
  draft: IdeaDraft | null;
  report: EvaluationReport | null;
  createdAt: number;
}

interface ChatContextValue {
  sessionId: string | null;
  messages: ChatMessage[];
  /** The advisor's last turn said it has everything it needs to draft. */
  readyToEvaluate: boolean;
  draft: IdeaDraft | null;
  report: EvaluationReport | null;
  stage: SessionStage;
  busy: ChatBusyState;
  error: ChatErrorState;
  hasConversation: boolean;
  sendMessage: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  generateDraft: () => Promise<void>;
  proceed: () => Promise<void>;
  refineDraft: () => void;
  startNewChat: () => void;
  resumeSession: (session: Session) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const TITLE_MAX_LENGTH = 60;

function emptySession(language: LanguageCode): ActiveSession {
  return {
    id: null,
    title: "",
    language,
    stage: "chatting",
    messages: [],
    draft: null,
    report: null,
    createdAt: 0,
  };
}

function makeMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The opening turn: a fixed, translated question so the first tap needs no network round-trip.
 * It is stored as the first message once the user answers, so Gemini sees what was asked.
 */
export function buildIntroMessage(t: TranslateFn): ChatMessage {
  const option = (key: "food" | "tailor" | "shop" | "farm") => ({
    label: t(`chat.opt.${key}`),
    description: t(`chat.opt.${key}.desc`),
  });
  return {
    id: "intro",
    role: "assistant",
    text: t("chat.intro"),
    createdAt: Date.now(),
    question: {
      text: t("chat.firstQuestion"),
      options: [option("food"), option("tailor"), option("shop"), option("farm")],
    },
    readyToEvaluate: false,
  };
}

/** Details the advisor should ask about when the user refines a draft that has gaps. */
function missingFromDraft(draft: IdeaDraft): string[] {
  const focus: string[] = [];
  const noRevenue = draft.monthlyRevenue === null;
  if (noRevenue && draft.pricePerUnit === null) focus.push("selling price per unit");
  if (noRevenue && draft.expectedMonthlyUnits === null) focus.push("expected sales per day or month");
  if (draft.variableCostPerUnit === null) focus.push("material cost per unit");
  if (draft.monthlyFixedCosts === null) focus.push("monthly fixed costs");
  if (draft.startupInvestment === null) focus.push("total money needed to start");
  return [...focus, ...draft.missingInfo];
}

function titleFrom(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.text.trim() ?? "";
  return first.length > TITLE_MAX_LENGTH ? `${first.slice(0, TITLE_MAX_LENGTH - 1)}…` : first;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { language, t } = useI18n();

  const [session, setSession] = useState<ActiveSession>(() => emptySession(language));
  const [busy, setBusy] = useState<ChatBusyState>(null);
  const [error, setError] = useState<ChatErrorState>(null);

  // Async steps read the latest session through this ref so a late Gemini response can tell
  // whether the user has since moved on to a different session.
  const sessionRef = useRef(session);
  const busyRef = useRef<ChatBusyState>(null);

  const uid = user?.uid ?? null;

  // Saved profile answers go into every prompt so the advisor never re-asks them.
  const advisorContext = useMemo<AdvisorContext>(
    () => ({ language, fullName: user?.fullName, preferences: user?.preferences ?? null }),
    [language, user?.fullName, user?.preferences]
  );

  const commit = useCallback(
    (next: ActiveSession) => {
      sessionRef.current = next;
      setSession(next);
      if (!uid || !next.id) return;
      const record: Session = {
        id: next.id,
        title: next.draft?.title || next.title,
        language: next.language,
        stage: next.stage,
        messages: next.messages,
        draft: next.draft,
        report: next.report,
        createdAt: next.createdAt,
        updatedAt: Date.now(),
      };
      saveSession(uid, record).catch((err) =>
        console.warn("[Chat] Failed to save session:", err)
      );
    },
    [uid]
  );

  const setBusyState = useCallback((state: ChatBusyState) => {
    busyRef.current = state;
    setBusy(state);
  }, []);

  const startNewChat = useCallback(() => {
    sessionRef.current = emptySession(language);
    setSession(sessionRef.current);
    setError(null);
    setBusyState(null);
  }, [language, setBusyState]);

  // A different (or no) signed-in user must never see the previous user's conversation.
  useEffect(() => {
    startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const requestReply = useCallback(
    async (snapshot: ActiveSession, focus: string[] = []) => {
      setBusyState("replying");
      setError(null);
      try {
        const turn = await getChatReply(snapshot.messages, advisorContext, t("chat.evaluate"), focus);
        if (sessionRef.current.id !== snapshot.id) return;
        const current = sessionRef.current;
        commit({
          ...current,
          messages: [
            ...current.messages,
            {
              id: makeMessageId(),
              role: "assistant",
              text: turn.message,
              question: turn.question,
              readyToEvaluate: turn.readyToEvaluate,
              createdAt: Date.now(),
            },
          ],
        });
      } catch (err) {
        console.warn("[Chat] Reply failed:", err);
        if (sessionRef.current.id === snapshot.id) setError("reply");
      } finally {
        if (sessionRef.current.id === snapshot.id) setBusyState(null);
      }
    },
    [commit, advisorContext, setBusyState, t]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const current = sessionRef.current;
      if (!trimmed || busyRef.current || current.stage !== "chatting") return;

      const isNew = current.id === null;
      const messages: ChatMessage[] = [
        ...(isNew ? [buildIntroMessage(t)] : current.messages),
        { id: makeMessageId(), role: "user", text: trimmed, createdAt: Date.now() },
      ];
      const next: ActiveSession = {
        ...current,
        id: current.id ?? (uid ? newSessionId(uid) : `local-${makeMessageId()}`),
        createdAt: isNew ? Date.now() : current.createdAt,
        language: isNew ? language : current.language,
        title: current.title || titleFrom(messages),
        messages,
      };
      commit(next);
      await requestReply(next);
    },
    [commit, language, requestReply, t, uid]
  );

  const generateDraft = useCallback(async () => {
    const snapshot = sessionRef.current;
    if (busyRef.current || !snapshot.messages.some((m) => m.role === "user")) return;

    setBusyState("drafting");
    setError(null);
    try {
      const draft = await draftIdea(snapshot.messages, advisorContext);
      if (sessionRef.current.id !== snapshot.id) return;
      commit({ ...sessionRef.current, draft, stage: "drafted" });
    } catch (err) {
      console.warn("[Chat] Draft failed:", err);
      if (sessionRef.current.id === snapshot.id) setError("draft");
    } finally {
      if (sessionRef.current.id === snapshot.id) setBusyState(null);
    }
  }, [commit, advisorContext, setBusyState]);

  const proceed = useCallback(async () => {
    const snapshot = sessionRef.current;
    if (busyRef.current || !snapshot.draft) return;

    setBusyState("evaluating");
    setError(null);
    try {
      const report = await evaluateIdea(snapshot.draft, advisorContext);
      if (sessionRef.current.id !== snapshot.id) return;
      commit({ ...sessionRef.current, report, stage: "evaluated" });
    } catch (err) {
      console.warn("[Chat] Evaluation failed:", err);
      if (sessionRef.current.id === snapshot.id) setError("evaluate");
    } finally {
      if (sessionRef.current.id === snapshot.id) setBusyState(null);
    }
  }, [commit, advisorContext, setBusyState]);

  const refineDraft = useCallback(() => {
    if (busyRef.current) return;
    const current = sessionRef.current;
    const focus = current.draft ? missingFromDraft(current.draft) : [];
    setError(null);
    const next: ActiveSession = { ...current, draft: null, stage: "chatting" };
    commit(next);
    // Have the advisor ask straight away about whatever the draft was missing.
    void requestReply(next, focus);
  }, [commit, requestReply]);

  const retry = useCallback(async () => {
    if (error === "reply") await requestReply(sessionRef.current);
    else if (error === "draft") await generateDraft();
    else if (error === "evaluate") await proceed();
  }, [error, generateDraft, proceed, requestReply]);

  const resumeSession = useCallback(
    (saved: Session) => {
      sessionRef.current = {
        id: saved.id,
        title: saved.title,
        language: saved.language,
        stage: saved.stage,
        messages: saved.messages,
        draft: saved.draft,
        report: saved.report,
        createdAt: saved.createdAt,
      };
      setSession(sessionRef.current);
      setError(null);
      setBusyState(null);
    },
    [setBusyState]
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      sessionId: session.id,
      messages: session.messages,
      readyToEvaluate: !!session.messages[session.messages.length - 1]?.readyToEvaluate,
      draft: session.draft,
      report: session.report,
      stage: session.stage,
      busy,
      error,
      hasConversation: session.messages.length > 0,
      sendMessage,
      retry,
      generateDraft,
      proceed,
      refineDraft,
      startNewChat,
      resumeSession,
    }),
    [session, busy, error, sendMessage, retry, generateDraft, proceed, refineDraft, startNewChat, resumeSession]
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
