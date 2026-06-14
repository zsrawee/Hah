/**
 * Speech Review API
 *
 * Compares the user's spoken hadith against the target text.
 *
 * Two modes:
 *   1. Client-side transcription (RECOMMENDED, 🆓 FREE):
 *      → Browser uses Web Speech API to transcribe
 *      → Sends { spokenText, targetText } directly
 *      → Server just does the comparison analysis
 *
 *   2. Server-side transcription (requires API key):
 *      → Sends audio blob + targetText
 *      → Server transcribes via NVIDIA or OpenAI, then analyzes
 *
 * After transcription, compares against the target Hadith with
 * diacritics-aware (tashkeel) analysis — tracks fatha, damma, kasra, shadda
 * independently from base letters.
 *
 * ── Configuration ────────────────────────────────────────────────────────
 * No env vars needed for mode 1 (client-side transcription).
 * For mode 2, see .env.example.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// Arabic Text Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Arabic diacritics (tashkeel) Unicode ranges:
 *  064B–065F  : Standard Quranic diacritics (fatha, damma, kasra, shadda, sukun, tanwin, etc.)
 *  0670       : Superscript alef
 *  06D6–06DC  : Small high diacritics
 *  06DF–06E8  : Additional diacritics
 *  06EA–06ED  : Additional diacritics
 */
const TASHKEEL_PATTERN = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

/** Normalize Arabic letters for fuzzy comparison (excludes tashkeel). */
function normalizeArabic(text: string): string {
  return text
    .replace(TASHKEEL_PATTERN, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')             // Tatweel/kashida
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extract which diacritics (tashkeel) are on each letter.
 * Returns a map: letter-position → set of diacritic chars.
 */
function extractTashkeel(text: string): Map<number, string[]> {
  const map = new Map<number, string[]>();
  let letterIdx = -1;
  for (const ch of text) {
    if (TASHKEEL_PATTERN.test(ch)) {
      if (letterIdx >= 0) {
        const existing = map.get(letterIdx) || [];
        existing.push(ch);
        map.set(letterIdx, existing);
      }
    } else if (/\S/.test(ch)) {
      letterIdx++;
    }
  }
  return map;
}

/** Compute tashkeel accuracy between reference and spoken text. */
function compareTashkeel(
  refTashkeel: Map<number, string[]>,
  spokenTashkeel: Map<number, string[]>,
  letterCount: number,
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (let i = 0; i < letterCount; i++) {
    const ref = refTashkeel.get(i) || [];
    const spoken = spokenTashkeel.get(i) || [];
    const refSet = new Set(ref);
    const spokenSet = new Set(spoken);
    Array.from(refSet).forEach((d) => {
      total++;
      if (spokenSet.has(d)) correct++;
    });
  }
  return { correct, total: Math.max(total, 1) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Comparison Engine
// ═══════════════════════════════════════════════════════════════════════════

interface WordMatch {
  word: string;
  match: boolean;
  tashkeelAccuracy?: number;
}

interface AnalysisResult {
  score: number;
  wordAccuracy: number;
  tashkeelScore: number;
  wordResults: WordMatch[];
  feedback: string[];
  recognizedText: string;
}

/** Analyse the user's spoken text against the Hadith reference. */
function analyzeSpeech(spokenText: string, referenceText: string): AnalysisResult {
  const refNorm = normalizeArabic(referenceText);
  const spokenNorm = normalizeArabic(spokenText);

  const refWords = refNorm.split(/\s+/).filter(Boolean);
  const spokenWords = spokenNorm.split(/\s+/).filter(Boolean);

  if (refWords.length === 0) {
    return {
      score: 0,
      wordAccuracy: 0,
      tashkeelScore: 0,
      wordResults: [],
      feedback: ['Reference text is empty.'],
      recognizedText: spokenText,
    };
  }

  // ── Word-level matching ──
  const spokenCopy = [...spokenWords];
  let matchCount = 0;
  const wordResults: WordMatch[] = [];

  for (const refWord of refWords) {
    const idx = spokenCopy.indexOf(refWord);
    const found = idx !== -1;
    if (found) {
      matchCount++;
      spokenCopy[idx] = '';
    }
    wordResults.push({ word: refWord, match: found });
  }

  const wordAccuracy = Math.round((matchCount / refWords.length) * 100);

  // ── Character-level + tashkeel comparison ──
  let charMatch = 0;
  let charTotal = Math.max(refNorm.length, 1);
  for (let i = 0; i < Math.min(refNorm.length, spokenNorm.length); i++) {
    if (refNorm[i] === spokenNorm[i]) charMatch++;
  }
  const score = Math.round((charMatch / charTotal) * 100);

  // ── Tashkeel accuracy ──
  const refTashkeel = extractTashkeel(referenceText);
  const spokenTashkeel = extractTashkeel(spokenText);
  const tashkeelResult = compareTashkeel(refTashkeel, spokenTashkeel, refNorm.length);
  const tashkeelScore = Math.round((tashkeelResult.correct / tashkeelResult.total) * 100);

  // ── Per-word tashkeel accuracy ──
  if (tashkeelResult.total > 1) {
    let letterPos = 0;
    for (let wi = 0; wi < wordResults.length && wi < refWords.length; wi++) {
      const wordLen = refWords[wi].length;
      if (wordLen === 0) continue;
      let wordTashkeelCorrect = 0;
      let wordTashkeelTotal = 0;
      for (let li = 0; li < wordLen; li++, letterPos++) {
        const refD = refTashkeel.get(letterPos) || [];
        const spokenD = spokenTashkeel.get(letterPos) || [];
        const refSet = new Set(refD);
        const spokenSet = new Set(spokenD);
        Array.from(refSet).forEach((d) => {
          wordTashkeelTotal++;
          if (spokenSet.has(d)) wordTashkeelCorrect++;
        });
      }
      wordResults[wi].tashkeelAccuracy =
        wordTashkeelTotal > 0
          ? Math.round((wordTashkeelCorrect / wordTashkeelTotal) * 100)
          : undefined;
    }
  }

  // ── Feedback generation ──
  const feedback: string[] = [];

  if (wordAccuracy >= 90 && tashkeelScore >= 90) {
    feedback.push('🌟 ممتاز! Your recitation is excellent with correct tashkeel.');
    feedback.push(`Word accuracy: ${wordAccuracy}% · Tashkeel accuracy: ${tashkeelScore}%`);
  } else if (wordAccuracy >= 75) {
    feedback.push(`👍 Good word recognition (${wordAccuracy}%).`);
    if (tashkeelScore < 75) {
      feedback.push(`Pay attention to the diacritics (tashkeel) — only ${tashkeelScore}% correct.`);
      feedback.push('Focus on pronouncing fatha, damma, kasra, and shadda clearly.');
    } else {
      feedback.push(`Tashkeel accuracy is good at ${tashkeelScore}%.`);
    }
  } else if (wordAccuracy >= 50) {
    feedback.push(`💪 Partial match (${wordAccuracy}% words recognized).`);
    feedback.push('Try slowing down and pronouncing each word separately.');
    if (tashkeelScore < 60) {
      feedback.push('Also work on the vowel sounds (harakat) — they change the meaning!');
    }
  } else {
    feedback.push('🎯 Most words were not recognized. Tips:');
    feedback.push('• Speak clearly and at a moderate pace');
    feedback.push('• Make sure your microphone is close');
    feedback.push('• Practice shorter phrases first');
  }

  if (spokenWords.length > refWords.length * 1.5) {
    feedback.push('You spoke more words than expected — try to match the exact phrase.');
  }

  return {
    score,
    wordAccuracy,
    tashkeelScore,
    wordResults,
    feedback,
    recognizedText: spokenText,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    const targetText = (formData.get('targetText') || formData.get('text')) as string | null;
    const spokenText = formData.get('spokenText') as string | null;

    if (!targetText) {
      return NextResponse.json(
        { error: 'Missing target text' },
        { status: 400 },
      );
    }

    // ── Get the transcribed text ──
    let transcription: string | null = spokenText;

    // If no transcription provided, try to transcribe audio
    if (!transcription) {
      if (!audioFile) {
        return NextResponse.json(
          {
            accuracy: 0,
            wordAccuracy: 0,
            pronunciationScore: 0,
            wordResults: [],
            feedback: [
              '🎤 استخدم المتصفح للتعرف على الصوت مجاناً',
              '',
              'أو استخدم أحد الخيارات المدفوعة:',
              '• NVIDIA_API_KEY في .env.local',
              '• OPENAI_API_KEY في .env.local',
            ],
            recognizedText: '',
          },
          { status: 200 },
        );
      }

      // Transcribe via configured API backend
      const mode = process.env.NVIDIA_API_KEY?.trim()
        ? 'nvidia' as const
        : process.env.OPENAI_API_KEY?.trim()
          ? 'openai' as const
          : null;

      if (!mode) {
        return NextResponse.json(
          {
            accuracy: 0,
            wordAccuracy: 0,
            pronunciationScore: 0,
            wordResults: [],
            feedback: [
              '🔊 لم نقم بإعداد التعرف على الصوت بعد',
              'حاول مرة أخرى باستخدام المتصفح',
            ],
            recognizedText: '',
          },
          { status: 200 },
        );
      }

      try {
        if (mode === 'nvidia') {
          transcription = await transcribeWithNvidia(audioFile, process.env.NVIDIA_API_KEY!);
        } else {
          transcription = await transcribeWithOpenAI(audioFile, process.env.OPENAI_API_KEY!);
        }
      } catch (err: any) {
        return NextResponse.json(
          {
            accuracy: 0,
            wordAccuracy: 0,
            pronunciationScore: 0,
            wordResults: [],
            feedback: [
              '❌ Transcription failed.',
              `Error: ${err.message || 'Unknown error'}`,
            ],
            recognizedText: '',
          },
          { status: 200 },
        );
      }
    }

    if (!transcription?.trim()) {
      return NextResponse.json(
        {
          accuracy: 0,
          wordAccuracy: 0,
          pronunciationScore: 0,
          wordResults: [],
          feedback: [
            'No speech detected.',
            'تأكد من أن الميكروفون قريب منك وتحدث بوضوح',
          ],
          recognizedText: '',
        },
        { status: 200 },
      );
    }

    // ── Analyze ──
    const result = analyzeSpeech(transcription, targetText);

    return NextResponse.json({
      accuracy: result.score,
      wordAccuracy: result.wordAccuracy,
      pronunciationScore: result.tashkeelScore,
      wordResults: result.wordResults,
      feedback: result.feedback,
      recognizedText: result.recognizedText,
    });
  } catch (err: any) {
    console.error('Speech review error:', err);
    return NextResponse.json(
      {
        accuracy: 0,
        wordAccuracy: 0,
        pronunciationScore: 0,
        wordResults: [],
        feedback: [`Unexpected error: ${err.message || 'Unknown'}`],
        recognizedText: '',
      },
      { status: 200 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API Backends (optional)
// ═══════════════════════════════════════════════════════════════════════════

async function transcribeWithNvidia(audioBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'nvidia/fastconformer-ctc-hybrid-large');
  formData.append('language', 'ar');

  const response = await fetch(
    'https://integrate.api.nvidia.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NVIDIA FastConformer error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

async function transcribeWithOpenAI(audioBlob: Blob, apiKey: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'ar');
  formData.append('response_format', 'json');

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Whisper error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}
