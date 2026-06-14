export interface WordResult {
  word: string;
  match: boolean;
  similarity?: number;
  /** Diacritics (tashkeel) accuracy for this word, 0–100. */
  tashkeelAccuracy?: number;
}

export interface SpeechResult {
  accuracy: number;
  wordAccuracy: number;
  /** Pronunciation score based on tashkeel (diacritics) accuracy. */
  pronunciationScore: number;
  wordResults: WordResult[];
  feedback: string[];
  recognizedText?: string;
}

/**
 * Analyze spoken text against target hadith text.
 * Sends the transcribed text to the server for comparison.
 * No audio needed — works with Web Speech API (free, client-side).
 */
export async function analyzeArabicSpeech(
  spokenText: string,
  targetText: string,
): Promise<SpeechResult> {
  const response = await fetch("/api/speech-review", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      spokenText,
      targetText,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Speech analysis failed");
  }

  return data as SpeechResult;
}

/**
 * Legacy: analyze audio blob via server-side API.
 * Only works if NVIDIA_API_KEY or OPENAI_API_KEY is configured.
 */
export async function analyzeArabicSpeechAudio(
  audioBlob: Blob,
  targetText: string,
): Promise<SpeechResult> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  formData.append("targetText", targetText);

  const response = await fetch("/api/speech-review", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Speech analysis failed");
  }

  return data as SpeechResult;
}

/**
 * Check if the browser supports the Web Speech API for Arabic.
 */
export function isSpeechRecognitionSupported(): boolean {
  return !!(
    (typeof window !== "undefined") &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window))
  );
}

/**
 * Create a Web Speech recognition instance configured for Arabic.
 */
export function createArabicSpeechRecognizer(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) return null;

  const recognizer = new SpeechRecognitionAPI();
  recognizer.lang = "ar";
  recognizer.continuous = true;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  return recognizer;
}
