/**
 * @fileoverview Advisor conversations, stored at /users/{uid}/sessions/{sessionId}.
 * A conversation may be linked to a feasibility study, in which case the advisor answers with
 * that report as context.
 */

import type { LanguageCode } from "../i18n/languages";

export type ChatRole = "user" | "assistant";

/** One answer choice in an advisor question. */
export interface ChatOption {
  label: string;
  description: string;
}

/** A multiple-choice question the advisor asks; the user taps an option or types their own. */
export interface ChatQuestion {
  text: string;
  options: ChatOption[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Assistant only: follow-up question with tappable options, if any. */
  question?: ChatQuestion | null;
}

export interface Session {
  id: string;
  title: string;
  language: LanguageCode;
  messages: ChatMessage[];
  /** Set when the conversation is about a specific feasibility study. */
  studyId: string | null;
  studyTitle: string | null;
  createdAt: number;
  updatedAt: number;
}
