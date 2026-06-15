/**
 * Hadith data layer using fawazahmed0/hadith-api (free, CDN-hosted).
 * Uses per-hadith endpoints for individual lookups and cached editions for pagination.
 * Base URL: https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/
 */

const API_BASE = process.env.HADITH_API_BASE_URL || 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';

// Pre-computed hadith counts per collection (for random hadith without fetching full edition)
const COLLECTION_SIZES: Record<number, number> = {
  1: 7589, 2: 7563, 3: 5765, 10: 5274, 30: 3998, 38: 4343, 40: 1858, 101: 42,
};

const COLLECTION_MAP: Record<number, string> = {
  1: 'bukhari', 2: 'muslim', 3: 'nasai', 10: 'abudawud',
  30: 'tirmidhi', 38: 'ibnmajah', 40: 'malik', 101: 'nawawi',
};

const SLUG_TO_ID: Record<string, number> = {};
for (const [id, slug] of Object.entries(COLLECTION_MAP)) SLUG_TO_ID[slug] = parseInt(id);

const COLLECTION_NAMES: Record<number, { ar: string; en: string; slug: string; size: number }> = {
  1: { ar: 'صحيح البخاري', en: 'Sahih al-Bukhari', slug: 'bukhari', size: 7589 },
  2: { ar: 'صحيح مسلم', en: 'Sahih Muslim', slug: 'muslim', size: 7563 },
  3: { ar: 'سنن النسائي', en: "Sunan an-Nasa'i", slug: 'nasai', size: 5765 },
  10: { ar: 'سنن أبي داود', en: 'Sunan Abi Dawud', slug: 'abudawud', size: 5274 },
  30: { ar: 'جامع الترمذي', en: 'Jami` at-Tirmidhi', slug: 'tirmidhi', size: 3998 },
  38: { ar: 'سنن ابن ماجه', en: 'Sunan Ibn Majah', slug: 'ibnmajah', size: 4343 },
  40: { ar: 'موطأ مالك', en: 'Muwatta Malik', slug: 'malik', size: 1858 },
  101: { ar: 'الأربعون النووية', en: "An-Nawawi's 40 Hadith", slug: 'nawawi', size: 42 },
};

// In-memory cache (per function invocation)
const editionCache: Map<string, { hadiths: any[] }> = new Map();

type Lang = 'ara' | 'eng';

async function fetchJSON(url: string, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

/** Fetch a single hadith by slug and number (fast - tiny JSON file) */
async function fetchSingleHadith(slug: string, lang: Lang, number: number): Promise<any | null> {
  const url = `${API_BASE}${lang}-${slug}/${number}.json`;
  try {
    const data = await fetchJSON(url, 1);
    return data.hadiths?.[0] || null;
  } catch {
    // Try fallback: .min.json
    try {
      const data = await fetchJSON(`${url.replace('.json', '')}.min.json`, 1);
      return data.hadiths?.[0] || null;
    } catch {
      return null;
    }
  }
}

/** Fetch a full edition (cached) - used for pagination/search */
async function fetchEdition(slug: string, lang: Lang): Promise<{ hadiths: any[] }> {
  const key = `${lang}-${slug}`;
  if (editionCache.has(key)) return editionCache.get(key)!;

  const url = `${API_BASE}${lang}-${slug}.json`;
  const data = await fetchJSON(url);
  const result = { hadiths: data.hadiths || [] };
  editionCache.set(key, result);
  return result;
}

/** Search in-memory array of hadiths for matching text */
function searchInArray(hadiths: any[], terms: string[], field: string, max: number): any[] {
  const results: any[] = [];
  for (const h of hadiths) {
    if (results.length >= max) break;
    const text = ((h as any)[field] || '').toLowerCase();
    if (terms.every(t => text.includes(t))) results.push(h);
  }
  return results;
}

function formatHadith(h: any, collectionId: number, en: any | null, hadithNumber?: number): any {
  if (!h && hadithNumber) {
    return {
      collection: COLLECTION_NAMES[collectionId]?.ar || '',
      collectionId,
      collection_id: collectionId,
      hadithNumber: [hadithNumber],
      urn: `${collectionId}.${hadithNumber}`,
      display_number: String(hadithNumber),
      book_id: 1,
      // Flat fields (for search route mapping)
      content: '', grades: '', narrator_prefix: '', narrator_postfix: '',
      // Nested fields (for HadithCard / random route direct usage)
      arabic: { urn: `${collectionId}.${hadithNumber}`, content: '', grades: '', narrator_prefix: '', narrator_postfix: '' },
      english: null,
    };
  }
  if (!h) return null;

  const num = hadithNumber || h.hadithnumber;
  const text = h.text || '';
  const gradesStr = formatGrades(h.grades);

  return {
    collection: COLLECTION_NAMES[collectionId]?.ar || '',
    collectionId,
    collection_id: collectionId,
    urn: `${collectionId}.${num}`,
    hadithNumber: [num],
    // Flat fields (for search route mapping which re-wraps them)
    display_number: String(num),
    book_id: 1,
    content: text,
    grades: gradesStr,
    narrator_prefix: '',
    narrator_postfix: '',
    narrator: '',
    narratorArabic: '',
    // Nested fields (for HadithCard / random route direct usage)
    arabic: {
      urn: `${collectionId}.${num}`,
      collection_id: collectionId,
      content: text,
      narrator_prefix: '',
      narrator_postfix: '',
      grades: gradesStr,
      text,
    },
    english: en ? {
      urn: `${collectionId}.${num}`,
      arabic_urn: `${collectionId}.${num}`,
      collection_id: collectionId,
      content: en.text || '',
      narrator_prefix: '',
      narrator_postfix: '',
      grades: formatGrades(en.grades),
      reference: '',
      text: en.text || '',
    } : null,
  };
}

function formatGrades(grades: any[]): string {
  if (!grades || grades.length === 0) return '';

  // Map common English grade terms to Arabic
  const gradeMap: Record<string, string> = {
    'sahih': 'صحيح',
    'hasan': 'حسن',
    "da'if": 'ضعيف',
    'daif': 'ضعيف',
    'mawdu': 'موضوع',
    'mawdu\'': 'موضوع',
    'munkar': 'منكر',
    'qawi': 'قوي',
    'jayyid': 'جيد',
    'hasan sahih': 'حسن صحيح',
    'sahih darussalam': 'صحيح',
    'hasan darussalam': 'حسن',
    'daif darussalam': 'ضعيف',
    'sahih al-albani': 'صحيح',
    'hasan al-albani': 'حسن',
  };

  // Extract unique grades and translate
  const seen = new Set<string>();
  const arabicGrades: string[] = [];

  for (const g of grades) {
    let grade = (g.grade || '').trim().toLowerCase();
    // Remove parenthetical qualifiers like "(Darussalam)"
    grade = grade.replace(/\s*\([^)]*\)/g, '').trim();
    if (!grade || seen.has(grade)) continue;
    seen.add(grade);
    arabicGrades.push(gradeMap[grade] || g.grade.toString().trim());
  }

  return arabicGrades.join('، ');
}

export const hadithAPI = {
  async ensureConnected() {},

  getCollections() {
    return Promise.resolve(
      Object.entries(COLLECTION_NAMES).map(([id, info]) => ({
        id: parseInt(id), title: info.ar, title_en: info.en, status: 'supported',
      }))
    );
  },

  getCollection(id: number) {
    const info = COLLECTION_NAMES[id];
    return Promise.resolve(info ? { id, title: info.ar, title_en: info.en, status: 'supported' } : null);
  },

  async getBooks(collectionId?: number) {
    if (collectionId !== undefined) {
      const info = COLLECTION_NAMES[collectionId];
      return info ? [{ id: 1, name: info.en, bookNumber: 1, hadithCount: info.size }] : [];
    }
    return Object.entries(COLLECTION_NAMES).map(([id, info]) => ({
      id: 1, name: info.en, bookNumber: 1, hadithCount: info.size, collection_id: parseInt(id),
    }));
  },

  async getHadiths(collectionId: number, options: { limit?: number; offset?: number; bookId?: number } = {}) {
    const slug = COLLECTION_MAP[collectionId];
    if (!slug) return { hadiths: [], total: 0 };

    const [edition, engEdition] = await Promise.all([
      fetchEdition(slug, 'ara'),
      fetchEdition(slug, 'eng'),
    ]);

    const total = edition.hadiths.length;
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const slice = edition.hadiths.slice(offset, offset + limit);

    const hadiths = slice.map((h: any, i: number) => {
      const en = engEdition.hadiths[offset + i] || null;
      return formatHadith(h, collectionId, en);
    });

    return { hadiths, total };
  },

  async getHadithByUrn(urn: string | number) {
    const parts = String(urn).split('.');
    const cid = parseInt(parts[0]);
    const num = parseInt(parts[1]);
    if (isNaN(cid) || isNaN(num)) return null;

    const slug = COLLECTION_MAP[cid];
    if (!slug) return null;

    try {
      const [ara, eng] = await Promise.all([
        fetchSingleHadith(slug, 'ara', num),
        fetchSingleHadith(slug, 'eng', num),
      ]);
      return formatHadith(ara, cid, eng, num);
    } catch {
      return null;
    }
  },

  async getRandomHadith(collectionId?: number, excludeUrn?: string) {
    const ids = Object.keys(COLLECTION_MAP).map(Number);
    const cid = collectionId || ids[Math.floor(Math.random() * ids.length)];
    const slug = COLLECTION_MAP[cid];
    if (!slug) return null;

    const size = COLLECTION_SIZES[cid] || 7589;

    for (let attempt = 0; attempt < 30; attempt++) {
      const num = Math.floor(Math.random() * size) + 1;
      try {
        const [ara, eng] = await Promise.all([
          fetchSingleHadith(slug, 'ara', num),
          fetchSingleHadith(slug, 'eng', num),
        ]);
        if (!ara) continue;

        const hadith = formatHadith(ara, cid, eng, num);
        if (excludeUrn && hadith.urn === excludeUrn) continue;
        return hadith;
      } catch {
        continue;
      }
    }
    return null;
  },

  /**
   * Normalize Arabic text for better search matching.
   * Strips tashkeel (diacritics), normalizes alef/hamza variants,
   * normalizes teh marbuta, strips tatweel.
   */
  normalizeArabic(text: string): string {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '')           // strip tashkeel (fatha, damma, kasra, shadda, sukun, etc.)
      .replace(/[\u0610-\u061A]/g, '')                   // strip Arabic number signs
      .replace(/\u0640/g, '')                              // strip tatweel (ـ)
      .replace(/[\u0622\u0623\u0625]/g, '\u0627')       // normalize alef: آ أ إ → ا
      .replace(/\u0649/g, '\u064A')                       // normalize alif maqsura: ى → ي
      .replace(/\u0624/g, '\u0648')                       // normalize waw with hamza: ؤ → و
      .replace(/\u0626/g, '\u064A')                       // normalize ya with hamza: ئ → ي
      .replace(/\u0629/g, '\u0647')                       // normalize teh marbuta: ة → ه
      .toLowerCase();
  },

  async search(query: string, collectionId?: number, limit = 20) {
    const slugs = collectionId
      ? [COLLECTION_MAP[collectionId]].filter(Boolean)
      : Object.values(COLLECTION_MAP);

    const results: { arabic: any[]; english: any[] } = { arabic: [], english: [] };
    const terms = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const hasArabic = terms.some(t => /[\u0600-\u06FF]/.test(t));
    const engTerms = terms.filter(t => /[a-z]/.test(t));

    // Normalize Arabic terms for matching
    const arabicTerms = terms.filter(t => /[\u0600-\u06FF]/.test(t));
    const normalizedArabicTerms = arabicTerms.map(t => this.normalizeArabic(t));

    for (const slug of slugs) {
      if (results.arabic.length >= limit && results.english.length >= limit) break;

      try {
        const [edition, engEdition] = await Promise.all([
          fetchEdition(slug, 'ara'),
          fetchEdition(slug, 'eng'),
        ]);

        // Arabic search – match against both raw and normalized text
        if (hasArabic && results.arabic.length < limit) {
          for (const h of edition.hadiths) {
            if (results.arabic.length >= limit) break;
            const text = (h.text || '').toLowerCase();
            const normalizedText = this.normalizeArabic(text);
            
            // Check both raw text and normalized text for matches
            const matchesRaw = arabicTerms.every(t => text.includes(t));
            const matchesNormalized = normalizedArabicTerms.every(t => normalizedText.includes(t));
            
            if (matchesRaw || matchesNormalized) {
              const cid = SLUG_TO_ID[slug];
              const en = engEdition.hadiths.find((e: any) => e.hadithnumber === h.hadithnumber);
              results.arabic.push(formatHadith(h, cid, en || null));
            }
          }
        }

        // English search
        if (engTerms.length > 0 && results.english.length < limit) {
          for (const h of engEdition.hadiths) {
            if (results.english.length >= limit) break;
            const body = (h.text || '').toLowerCase();
            if (engTerms.every(t => body.includes(t))) {
              const cid = SLUG_TO_ID[slug];
              results.english.push({
                arabic_urn: `${cid}.${h.hadithnumber}`,
                collection_id: cid,
                narrator_prefix: '',
                content: h.text || '',
                narrator_postfix: '',
                grades: formatGrades(h.grades),
                reference: '',
              });
            }
          }
        }
      } catch {
        continue;
      }
    }

    return {
      arabic: results.arabic, english: results.english,
      total: results.arabic.length + results.english.length,
    };
  },

  async getStats() {
    const totalHadiths = Object.values(COLLECTION_SIZES).reduce((a, b) => a + b, 0);
    return {
      collection_count: Object.keys(COLLECTION_MAP).length,
      total_books: Object.keys(COLLECTION_MAP).length,
      total_chapters: totalHadiths,
    };
  },
};
