/**
 * Mic button state machine: idle → recording → transcribing → idle.
 * The transcript is handed to `onTranscript` so the user can review it before sending.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Audio } from "expo-av";

import type { LanguageCode } from "../i18n/languages";
import { MicPermissionError, cancelRecording, startRecording, stopAndTranscribe } from "../services/voice";

export type VoiceState = "idle" | "recording" | "transcribing";
export type VoiceError = "permission" | "failed" | null;

export function useVoiceInput(language: LanguageCode, onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceError>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Never leave the microphone running if the screen goes away mid-recording.
  useEffect(
    () => () => {
      if (recordingRef.current) void cancelRecording(recordingRef.current);
    },
    []
  );

  const toggle = useCallback(async () => {
    setError(null);

    if (state === "idle") {
      try {
        recordingRef.current = await startRecording();
        setState("recording");
      } catch (err) {
        setError(err instanceof MicPermissionError ? "permission" : "failed");
        console.warn("[Voice] Could not start recording:", err);
      }
      return;
    }

    if (state === "recording" && recordingRef.current) {
      const recording = recordingRef.current;
      recordingRef.current = null;
      setState("transcribing");
      try {
        const text = await stopAndTranscribe(recording, language);
        if (text) onTranscript(text);
        else setError("failed");
      } catch (err) {
        console.warn("[Voice] Transcription failed:", err);
        setError("failed");
      } finally {
        setState("idle");
      }
    }
  }, [state, language, onTranscript]);

  return { state, error, toggle, clearError: () => setError(null) };
}
