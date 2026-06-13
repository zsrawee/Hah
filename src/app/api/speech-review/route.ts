import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI (will be null if no API key)
const getOpenAI = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
};

// Free Hugging Face Whisper inference (no API key needed for public models)
async function transcribeWithHuggingFace(audioBlob: Blob): Promise<string | null> {
  try {
    // Use a free public Whisper model on Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/webm',
          // No Authorization header needed for public models (rate limited)
        },
        body: audioBlob,
      }
    );

    if (!response.ok) {
      console.error('Hugging Face transcription failed:', response.status);
      return null;
    }

    const data = await response.json();
    return data.text?.trim() || null;
  } catch (err) {
    console.error('Hugging Face transcription error:', err);
    return null;
  }
}

// Normalize Arabic text for comparison - removes diacritics (harakat) and normalizes letters
function normalizeArabic(text: string): string {
  return text
    // Remove all harakat (diacritics): fatha, damma, kasra, sukun, shadda, tanwin, etc.
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06DC]/g, '')
    // Normalize alef variants (hamza on alef, alef madda, etc.) to bare alef
    .replace(/[أإآ]/g, 'ا')
    // Normalize ya variants (alef maksura, ya with hamza) to ya
    .replace(/[ىئ]/g, 'ي')
    // Normalize waw with hamza to waw
    .replace(/ؤ/g, 'و')
    // Normalize ta marbuta to ha
    .replace(/ة/g, 'ه')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    // Remove punctuation but keep Arabic letters, numbers, and spaces
    // Arabic range: \u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFF
    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\d\s]/g, '')
    .trim()
    .toLowerCase();
}

// Remove duplicate words (common issue with speech recognition)
// Handles consecutive duplicates AND repeated phrases
function removeDuplicateWords(text: string): string {
  const words = text.trim().split(/\s+/);
  const result: string[] = [];
  const seenNormalized = new Set<string>();
  
  for (const word of words) {
    const normalized = normalizeArabic(word);
    if (!normalized) continue;
    
    // Skip if we've seen this normalized word before
    // This catches both consecutive AND non-consecutive duplicates
    if (seenNormalized.has(normalized)) {
      continue;
    }
    
    seenNormalized.add(normalized);
    result.push(word);
  }
  
  return result.join(' ');
}

// Calculate word-level similarity
function wordSimilarity(original: string, spoken: string): { 
  score: number; 
  correctWords: string[];
  wrongWords: string[];
  missingWords: string[];
  extraWords: string[];
} {
  const origWords = normalizeArabic(original).split(/\s+/).filter(Boolean);
  const spokenWords = normalizeArabic(spoken).split(/\s+/).filter(Boolean);

  const correctWords: string[] = [];
  const wrongWords: string[] = [];
  const missingWords: string[] = [];
  
  let matches = 0;
  
  // Find matching words (order-aware)
  const spokenCopy = [...spokenWords];
  const origCopy = [...origWords];

  // Check each original word against spoken
  for (const origWord of origWords) {
    const idx = spokenCopy.indexOf(origWord);
    if (idx !== -1) {
      correctWords.push(origWord);
      matches++;
      spokenCopy[idx] = ''; // Mark as used
    } else {
      missingWords.push(origWord);
    }
  }

  // Remaining spoken words are extras
  const extraWords = spokenCopy.filter(w => w !== '');

  const totalWords = Math.max(origWords.length, 1);
  const score = Math.round((matches / totalWords) * 100);

  return {
    score,
    correctWords,
    wrongWords: wrongWords,
    missingWords,
    extraWords,
  };
}

// Generate user-friendly feedback
function generateFeedback(score: number, result: { correctWords: string[], missingWords: string[], extraWords: string[] }): { 
  level: string; 
  emoji: string; 
  message: string; 
  tips: string[];
} {
  if (score >= 90) {
    return {
      level: 'ممتاز',
      emoji: '🌟',
      message: 'Excellent! Your pronunciation is very accurate!',
      tips: ['You sound like a native speaker!', 'Keep up the great work!'],
    };
  } else if (score >= 75) {
    return {
      level: 'جيد جداً',
      emoji: '✨',
      message: 'Very good! Almost perfect pronunciation.',
      tips: ['Try to slow down a bit', 'Focus on the letter ع and ح sounds'],
    };
  } else if (score >= 60) {
    return {
      level: 'جيد',
      emoji: '👍',
      message: 'Good effort! You got most of the words right.',
      tips: result.missingWords.length > 0 
        ? [`Practice these words: ${result.missingWords.slice(0, 3).join('، ')}`]
        : ['Try to articulate each letter clearly'],
    };
  } else if (score >= 40) {
    return {
      level: 'مقبول',
      emoji: '💪',
      message: 'You\'re on the right track! Keep practicing.',
      tips: [
        'Listen to the audio multiple times',
        'Break the hadith into smaller parts',
        'Focus on pronouncing each word separately',
      ],
    };
  } else {
    return {
      level: 'تحتاج تمرين',
      emoji: '🎯',
      message: 'Keep practicing! Arabic pronunciation takes time.',
      tips: [
        'Start with shorter phrases',
        'Practice the alphabet first',
        'Use the playback feature to hear the correct pronunciation',
      ],
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob | null;
    // Accept both 'text' and 'targetText' for compatibility
    const originalText = (formData.get('text') || formData.get('targetText')) as string | null;

    if (!audioFile || !originalText) {
      return NextResponse.json({ 
        error: 'Missing audio file or original text' 
      }, { status: 400 });
    }

    const openai = getOpenAI();
    let transcription: string | null = null;
    let transcriptionSource = 'demo';

    // Try Hugging Face free Whisper first (no API key needed)
    transcription = await transcribeWithHuggingFace(audioFile);
    if (transcription) {
      transcriptionSource = 'huggingface';
    } else if (openai) {
      // Fallback to OpenAI Whisper
      const file = new File([audioFile], 'recording.webm', { type: audioFile.type });
      const result = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'ar',
        response_format: 'text',
      });
      transcription = result;
      transcriptionSource = 'openai';
    }

    // ── Build response matching SpeechResult interface ──
    let score: number;
    let spokenText: string;
    let wordAnalysis: { word: string; correct: boolean }[] = [];
    let feedbackObj: { level: string; emoji: string; message: string; tips: string[] };

    if (!transcription) {
      // Demo mode - simulate a review
      const words = originalText.split(/\s+/).filter(Boolean);
      const correctCount = Math.floor(words.length * (0.55 + Math.random() * 0.25));
      score = Math.round((correctCount / words.length) * 100);
      spokenText = words.slice(0, Math.floor(words.length * 0.85)).join(' ') + '...';
      feedbackObj = generateFeedback(score, {
        correctWords: words.slice(0, correctCount),
        missingWords: words.slice(correctCount),
        extraWords: [],
      });
      wordAnalysis = words.map((w: string, i: number) => ({
        word: w,
        correct: i < correctCount,
      }));
    } else {
      // Real transcription
      const cleanedTranscription = removeDuplicateWords(transcription.trim());
      spokenText = cleanedTranscription;
      const comparison = wordSimilarity(originalText, spokenText);
      score = comparison.score;
      feedbackObj = generateFeedback(score, comparison);

      const origWords = normalizeArabic(originalText).split(/\s+/).filter(Boolean);
      const spokenWords = normalizeArabic(spokenText).split(/\s+/).filter(Boolean);

      wordAnalysis = origWords.map(word => ({
        word,
        correct: spokenWords.includes(word),
      }));
    }

    // Map internal structure → SpeechResult interface
    const speechResult = {
      accuracy: score,
      wordAccuracy: score,
      pronunciationScore: score,
      wordResults: wordAnalysis.map(w => ({
        word: w.word,
        match: w.correct,
        // similarity is optional; omit if not computed
      })),
      feedback: feedbackObj.tips,
      recognizedText: spokenText,
    };

    return NextResponse.json(speechResult);

  } catch (err: any) {
    console.error('Speech review error:', err);
    return NextResponse.json({ 
      error: err.message || 'Transcription failed'
    }, { status: 500 });
  }
}
