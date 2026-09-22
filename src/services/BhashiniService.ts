/**
 * @fileoverview BhashiniService — Digital India BHASHINI API integration.
 *
 * Provides ASR (Automatic Speech Recognition), MT (Machine Translation),
 * and TTS (Text-to-Speech) capabilities via the BHASHINI Dhruva pipeline API.
 *
 * @see https://bhashini.gov.in
 * @module BhashiniService
 */

import {
  BhashiniASRResult,
  BhashiniTranslationResult,
  BhashiniTTSResult,
  BhashiniTaskType,
} from "../types/evaluation";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

/**
 * BHASHINI API configuration.
 * Replace with your actual credentials from the BHASHINI portal.
 */
const BHASHINI_CONFIG = {
  /** Pipeline inference endpoint. */
  inferenceUrl:
    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",

  /** Pipeline search/config endpoint for capability negotiation. */
  configUrl:
    "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline",

  /** Your BHASHINI User ID (obtained from portal registration). */
  userId: "YOUR_BHASHINI_USER_ID",

  /** Your BHASHINI API key. */
  apiKey: "YOUR_BHASHINI_API_KEY",

  /** Authorization token for the pipeline endpoint. */
  authToken: "YOUR_BHASHINI_AUTH_TOKEN",
};

/**
 * Supported Indian language codes (ISO-639).
 * These map to BHASHINI's supported source/target languages.
 */
export const SUPPORTED_LANGUAGES = {
  hi: "Hindi",
  en: "English",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// ──────────────────────────────────────────────
// Internal Types
// ──────────────────────────────────────────────

interface PipelineConfig {
  pipelineId: string;
  serviceIds: Record<BhashiniTaskType, string>;
}

interface PipelineInferenceResponse {
  pipelineResponse: Array<{
    taskType: string;
    output: Array<{
      source?: string;
      target?: string;
      audioContent?: string;
    }>;
  }>;
}

// ──────────────────────────────────────────────
// Service Implementation
// ──────────────────────────────────────────────

/**
 * BhashiniService — Integration hooks for the Digital India BHASHINI API.
 *
 * Supports:
 * - Speech-to-text (ASR) for voice input from rural users
 * - Text translation (MT) between 13 Indian languages + English
 * - Text-to-speech (TTS) for reading evaluation results aloud
 *
 * @example
 * ```typescript
 * const bhashini = BhashiniService.getInstance();
 *
 * // Transcribe Hindi audio
 * const asr = await bhashini.transcribeAudio(audioBase64, "hi");
 *
 * // Translate to English
 * const translation = await bhashini.translateText(asr.text, "hi", "en");
 *
 * // Read result aloud in Hindi
 * const tts = await bhashini.synthesizeSpeech("Your business is viable!", "hi");
 * ```
 */
export class BhashiniService {
  private static instance: BhashiniService | null = null;

  /**
   * Cached pipeline configs by language pair.
   * Key format: `${sourceLanguage}-${targetLanguage}-${taskType}`
   */
  private pipelineCache: Map<string, PipelineConfig> = new Map();

  private constructor() {}

  /** Get the singleton instance. */
  public static getInstance(): BhashiniService {
    if (!BhashiniService.instance) {
      BhashiniService.instance = new BhashiniService();
    }
    return BhashiniService.instance;
  }

  // ──────────────────────────────────────────
  // Pipeline Configuration
  // ──────────────────────────────────────────

  /**
   * Fetch the BHASHINI pipeline configuration for a given task and language pair.
   *
   * Uses the config endpoint to perform capability negotiation — this ensures
   * we use the most stable and appropriate model for the requested language pair
   * rather than hardcoding model IDs.
   *
   * @param taskType - The BHASHINI task type (asr, translation, tts).
   * @param sourceLanguage - Source language code.
   * @param targetLanguage - Target language code (same as source for ASR/TTS).
   * @returns Pipeline configuration with pipeline ID and service IDs.
   */
  private async getPipelineConfig(
    taskType: BhashiniTaskType,
    sourceLanguage: string,
    targetLanguage?: string
  ): Promise<PipelineConfig> {
    const cacheKey = `${sourceLanguage}-${targetLanguage ?? sourceLanguage}-${taskType}`;

    // Return cached config if available
    const cached = this.pipelineCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const taskConfig: Record<string, unknown> = {
        taskType,
        config: {
          language: {
            sourceLanguage,
            ...(targetLanguage && taskType === "translation"
              ? { targetLanguage }
              : {}),
          },
        },
      };

      const response = await fetch(BHASHINI_CONFIG.configUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          userID: BHASHINI_CONFIG.userId,
          ulcaApiKey: BHASHINI_CONFIG.apiKey,
        },
        body: JSON.stringify({
          pipelineTasks: [taskConfig],
          pipelineRequestConfig: {
            pipelineId: "64392f96dadc500b55c543cd",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `BHASHINI config API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      const config: PipelineConfig = {
        pipelineId:
          data.pipelineResponseConfig?.[0]?.pipelineId ?? "64392f96dadc500b55c543cd",
        serviceIds: {
          asr: data.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId ?? "",
          translation:
            data.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId ?? "",
          tts: data.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId ?? "",
        },
      };

      this.pipelineCache.set(cacheKey, config);
      return config;
    } catch (error) {
      console.error(
        "[BhashiniService] Failed to fetch pipeline config:",
        error
      );
      throw error;
    }
  }

  // ──────────────────────────────────────────
  // ASR — Automatic Speech Recognition
  // ──────────────────────────────────────────

  /**
   * Transcribe audio to text using BHASHINI ASR.
   *
   * @param audioBase64 - Base64-encoded audio data (WAV or MP3).
   * @param sourceLanguage - Expected language of the audio.
   * @returns Transcription result with text and confidence.
   */
  public async transcribeAudio(
    audioBase64: string,
    sourceLanguage: SupportedLanguageCode
  ): Promise<BhashiniASRResult> {
    console.log(
      `[BhashiniService] Transcribing audio in ${SUPPORTED_LANGUAGES[sourceLanguage]}...`
    );

    const config = await this.getPipelineConfig("asr", sourceLanguage);

    const requestBody = {
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: { sourceLanguage },
            serviceId: config.serviceIds.asr,
            audioFormat: "wav",
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        audio: [{ audioContent: audioBase64 }],
      },
    };

    const response = await this.callInferenceAPI(config.pipelineId, requestBody);

    const asrOutput = response.pipelineResponse?.[0]?.output?.[0];

    return {
      text: asrOutput?.source ?? "",
      detectedLanguage: sourceLanguage,
      confidence: 0.85, // BHASHINI doesn't always return confidence; default estimate
    };
  }

  // ──────────────────────────────────────────
  // MT — Machine Translation
  // ──────────────────────────────────────────

  /**
   * Translate text between supported Indian languages.
   *
   * @param text - Text to translate.
   * @param sourceLanguage - Source language code.
   * @param targetLanguage - Target language code.
   * @returns Translation result.
   */
  public async translateText(
    text: string,
    sourceLanguage: SupportedLanguageCode,
    targetLanguage: SupportedLanguageCode
  ): Promise<BhashiniTranslationResult> {
    console.log(
      `[BhashiniService] Translating ${SUPPORTED_LANGUAGES[sourceLanguage]} → ${SUPPORTED_LANGUAGES[targetLanguage]}...`
    );

    // No-op if source and target are the same
    if (sourceLanguage === targetLanguage) {
      return { translatedText: text, sourceLanguage, targetLanguage };
    }

    const config = await this.getPipelineConfig(
      "translation",
      sourceLanguage,
      targetLanguage
    );

    const requestBody = {
      pipelineTasks: [
        {
          taskType: "translation",
          config: {
            language: { sourceLanguage, targetLanguage },
            serviceId: config.serviceIds.translation,
          },
        },
      ],
      inputData: {
        input: [{ source: text }],
      },
    };

    const response = await this.callInferenceAPI(config.pipelineId, requestBody);

    const translationOutput = response.pipelineResponse?.[0]?.output?.[0];

    return {
      translatedText: translationOutput?.target ?? text,
      sourceLanguage,
      targetLanguage,
    };
  }

  // ──────────────────────────────────────────
  // TTS — Text-to-Speech
  // ──────────────────────────────────────────

  /**
   * Synthesize speech from text using BHASHINI TTS.
   *
   * @param text - Text to synthesize.
   * @param targetLanguage - Language for speech synthesis.
   * @returns TTS result with base64 audio content.
   */
  public async synthesizeSpeech(
    text: string,
    targetLanguage: SupportedLanguageCode
  ): Promise<BhashiniTTSResult> {
    console.log(
      `[BhashiniService] Synthesizing speech in ${SUPPORTED_LANGUAGES[targetLanguage]}...`
    );

    const config = await this.getPipelineConfig("tts", targetLanguage);

    const requestBody = {
      pipelineTasks: [
        {
          taskType: "tts",
          config: {
            language: { sourceLanguage: targetLanguage },
            serviceId: config.serviceIds.tts,
            gender: "female",
            samplingRate: 8000,
          },
        },
      ],
      inputData: {
        input: [{ source: text }],
      },
    };

    const response = await this.callInferenceAPI(config.pipelineId, requestBody);

    const ttsOutput = response.pipelineResponse?.[0]?.output?.[0];

    return {
      audioBase64: ttsOutput?.audioContent ?? "",
      audioFormat: "wav",
    };
  }

  // ──────────────────────────────────────────
  // Chained Pipeline: ASR → MT
  // ──────────────────────────────────────────

  /**
   * Convenience method: Transcribe audio and translate to English in one call.
   * Useful for processing voice input from rural users in any local language.
   *
   * @param audioBase64 - Base64-encoded audio.
   * @param sourceLanguage - Language of the audio.
   * @returns Object with both the transcription and the English translation.
   */
  public async transcribeAndTranslate(
    audioBase64: string,
    sourceLanguage: SupportedLanguageCode
  ): Promise<{
    transcription: BhashiniASRResult;
    translation: BhashiniTranslationResult;
  }> {
    // Step 1: ASR
    const transcription = await this.transcribeAudio(
      audioBase64,
      sourceLanguage
    );

    // Step 2: Translate to English (if not already English)
    const translation = await this.translateText(
      transcription.text,
      sourceLanguage,
      "en"
    );

    return { transcription, translation };
  }

  // ──────────────────────────────────────────
  // Internal API Call
  // ──────────────────────────────────────────

  /**
   * Call the BHASHINI pipeline inference API.
   *
   * @param pipelineId - The pipeline ID from config.
   * @param requestBody - The full request payload.
   * @returns Parsed inference response.
   */
  private async callInferenceAPI(
    pipelineId: string,
    requestBody: Record<string, unknown>
  ): Promise<PipelineInferenceResponse> {
    const response = await fetch(BHASHINI_CONFIG.inferenceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: BHASHINI_CONFIG.authToken,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `BHASHINI inference API error (${response.status}): ${errorText}`
      );
    }

    return (await response.json()) as PipelineInferenceResponse;
  }
}

// ──────────────────────────────────────────────
// Default Export
// ──────────────────────────────────────────────

export const bhashiniService = BhashiniService.getInstance();
