/**
 * @fileoverview Voice I/O.
 *
 * - Speech-to-text: records a short clip with expo-av (AAC in an .m4a container on both
 *   platforms) and sends it to Gemini for transcription, so it works the same in every supported
 *   language regardless of which speech packs the phone has installed.
 * - Text-to-speech: the device's own TTS engine via expo-speech, in the UI language's locale.
 */

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";

import { transcribeAudio } from "./AdvisorService";
import type { LanguageCode } from "../i18n/languages";

export class MicPermissionError extends Error {
  constructor() {
    super("Microphone permission denied");
    this.name = "MicPermissionError";
  }
}

/** Clips shorter than this are almost always accidental taps. */
const MIN_RECORDING_MS = 600;

export async function startRecording(): Promise<Audio.Recording> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) throw new MicPermissionError();

  Speech.stop();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  return recording;
}

/**
 * Stop recording and return the transcript ("" when nothing usable was said or the clip was too
 * short). The temporary audio file is always deleted.
 */
export async function stopAndTranscribe(
  recording: Audio.Recording,
  language: LanguageCode
): Promise<string> {
  const status = await recording.stopAndUnloadAsync().catch(() => null);
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  const uri = recording.getURI();
  if (!uri) return "";

  try {
    if (status && status.durationMillis < MIN_RECORDING_MS) return "";
    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return await transcribeAudio({ mimeType: "audio/mp4", data }, language);
  } finally {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

/** Discard a recording without transcribing it (e.g. the screen unmounted mid-recording). */
export async function cancelRecording(recording: Audio.Recording): Promise<void> {
  await recording.stopAndUnloadAsync().catch(() => {});
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  const uri = recording.getURI();
  if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export function speak(
  text: string,
  locale: string,
  callbacks: { onDone?: () => void } = {}
): void {
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    rate: 0.95,
    onDone: callbacks.onDone,
    onStopped: callbacks.onDone,
    onError: callbacks.onDone,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
