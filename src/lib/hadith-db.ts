/**
 * Hadith data layer using fawazahmed0/hadith-api (free, CDN-hosted).
 * No local DB, no sql.js, no WASM - just HTTP API calls from CDN.
 * Base URL: https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/
 */

const API_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';

// Cache for fetched editions (in-memory for the duration of a serverless function)
const editionCache: Map<string, { metadata: any; hadiths: any[] }> = new Map();
const totalHadithsCache: number | null = null;

// Collection IDs → fawazahmed0 edition slugs
const COLLECTION_MAP: Record<number, string> = {
  1: 'bukhari',
  2: 'muslim',
  3: 'nasai',
  10: 'abudawud',
  30: 'tirmidhi',
  38: 'ibnmajah',
  40: 'malik',
  101: 'nawawi',
};

// Reverse: slug → id
const SLUG_TO_ID: Record<string, number> = {};
for (const [id, slug] of Object.entries(COLLECTION_MAP)) {
  SLUG_TO_ID[slug] = parseInt(id);
}

// Collection metadata
const COLLECTION_NAMES: Record<number, { ar: string; en: string; slug: string }> = {
  1: { ar: 'صحيح البخاري', en: 'Sahih al-Bukhari', slug: 'bukhari' },
  2: { ar: 'صحيح مسلم', en: 'Sahih Muslim', slug: 'muslim' },
  3: { ar: 'سنن النسائي', en: "Sunan an-Nasa'i", slug: 'nasai' },
  10: { ar: 'سنن أبي داود', en: 'Sunan Abi Dawud', slug: 'abudawud' },
  30: { ar: 'جامع الترمذي', en: 'Jami` at-Tirmidhi', slug: 'tirmidhi' },
  38: { ar: 'سنن ابن ماجه', en: 'Sunan Ibn Majah', slug: 'ibnmajah' },
  40: { ar: 'موطأ مالك', en: 'Muwatta Malik', slug: 'malik' },
  101: { ar: 'الأربعون النووية', en: "An-Nawawi's 40 Hadith", slug: 'nawawi' },
};

async function fetchJSON(url: string, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

async function fetchEdition(slug: string, lang: 'ara' | 'eng'): Promise<{ metadata: any; hadiths: any[] }> {
  const cacheKey = `${lang}-${slug}`;
  if (editionCache.has(cacheKey)) return editionCache.get(cacheKey)!;
  
  const url = `${API_BASE}${lang}-${slug}.json`;
  const data = await fetchJSON(url);
  
  const result = { metadata: data.metadata || {}, hadiths: data.hadiths || [] };
  editionCache.set(cacheKey, result);
  return result;
}

async function fetchSingleHadith(slug: string, lang: 'ara' | 'eng', number: number): Promise<any> {
  const url = `${API_BASE}${lang}-${slug}/${number}.json`;
  const data = await fetchJSON(url);
  return data.hadiths?.[0] || null;
}

function mapLanguage(lang: 'ara' | 'eng'): 'arabic' | 'english' {
  return lang === 'ara' ? 'arabic' : 'english';
}

// ──── Public API ────

export const hadithAPI = {
  async ensureConnected(): Promise<void> {
    // Nothing to do - API-based, no connection needed
  },

  async getCollections(): Promise<any[]> {
    // Return only the collections supported by fawazahmed0 API
    return Object.entries(COLLECTION_NAMES).map(([id, info]) => ({
      id: parseInt(id),
      title: info.ar,
      title_en: info.en,
      status: 'supported',
    }));
  },

  async getCollection(id: number): Promise<any | null> {
    const info = COLLECTION_NAMES[id];
    if (!info) return null;
    return { id, title: info.ar, title_en: info.en, status: 'supported' };
  },

  async getBooks(collectionId?: number): Promise<any[]> {
    // fawazahmed0 doesn't separate books - return a single "book" per collection
    if (collectionId !== undefined) {
      const info = COLLECTION_NAMES[collectionId];
      if (!info) return [];
      return [{ id: 1, name: info.en, bookNumber: 1, hadithCount: 0 }];
    }
    return Object.entries(COLLECTION_NAMES).map(([id, info]) => ({
      id: 1,
      name: info.en,
      bookNumber: 1,
      hadithCount: 0,
      collection_id: parseInt(id),
    }));
  },

  async getHadiths(
    collectionId: number,
    options: { limit?: number; offset?: number; bookId?: number } = {}
  ): Promise<{ hadiths: any[]; total: number }> {
    const slug = COLLECTION_MAP[collectionId];
    if (!slug) return { hadiths: [], total: 0 };

    const edition = await fetchEdition(slug, 'ara');
    const englishEdition = await fetchEdition(slug, 'eng');
    
    const total = edition.hadiths.length;
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    const hadiths = edition.hadiths.slice(offset, offset + limit).map((h: any, i: number) => {
      const en = englishEdition.hadiths[offset + i];
      return formatHadith(h, collectionId, slug, en);
    });
    
    return { hadiths, total };
  },

  async getHadithByUrn(urn: string | number): Promise<any | null> {
    const urnStr = String(urn);
    // URN format: "collectionId.hadithNumber" e.g. "1.10" for Bukhari hadith 10
    const parts = urnStr.split('.');
    const collectionId = parseInt(parts[0]);
    const hadithNumber = parseInt(parts[1]);
    
    if (isNaN(collectionId) || isNaN(hadithNumber)) return null;
    const slug = COLLECTION_MAP[collectionId];
    if (!slug) return null;
    
    try {
      const [ara, eng] = await Promise.all([
        fetchSingleHadith(slug, 'ara', hadithNumber),
        fetchSingleHadith(slug, 'eng', hadithNumber),
      ]);
      return formatHadith(ara, collectionId, slug, eng);
    } catch {
      // Fallback: fetch full edition and get by index
      try {
        const edition = await fetchEdition(slug, 'ara');
        const englishEdition = await fetchEdition(slug, 'eng');
        const idx = edition.hadiths.findIndex((h: any) => h.hadithnumber === hadithNumber);
        if (idx === -1) return null;
        const h = edition.hadiths[idx];
        const en = englishEdition.hadiths[idx];
        return formatHadith(h, collectionId, slug, en);
      } catch {
        return null;
      }
    }
  },

  async getRandomHadith(collectionId?: number, excludeUrn?: string): Promise<any | null> {
    // Pick a random collection if not specified
    const collectionIds = Object.keys(COLLECTION_MAP).map(Number);
    const cid = collectionId || collectionIds[Math.floor(Math.random() * collectionIds.length)];
    const slug = COLLECTION_MAP[cid];
    if (!slug) return null;

    const edition = await fetchEdition(slug, 'ara');
    const englishEdition = await fetchEdition(slug, 'eng');
    const total = edition.hadiths.length;
    if (total === 0) return null;

    for (let attempt = 0; attempt < 50; attempt++) {
      const idx = Math.floor(Math.random() * total);
      const h = edition.hadiths[idx];
      const en = englishEdition.hadiths[idx];
      const hadith = formatHadith(h, cid, slug, en);
      
      const hadithUrn = `${cid}.${h.hadithnumber}`;
      if (excludeUrn && hadithUrn === excludeUrn) continue;
      
      return hadith;
    }
    return null;
  },

  async search(
    query: string,
    collectionId?: number,
    limit?: number
  ): Promise<{ arabic: any[]; english: any[]; total: number }> {
    const searchLimit = limit || 20;
    const results: { arabic: any[]; english: any[] } = { arabic: [], english: [] };
    
    const slugs = collectionId
      ? [COLLECTION_MAP[collectionId]].filter(Boolean)
      : Object.values(COLLECTION_MAP);
    
    for (const slug of slugs) {
      if (results.arabic.length >= searchLimit && results.english.length >= searchLimit) break;
      
      try {
        const edition = await fetchEdition(slug, 'ara');
        const englishEdition = await fetchEdition(slug, 'eng');
        
        const terms = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
        
        // Arabic search (text contains terms)
        for (const h of edition.hadiths) {
          if (results.arabic.length >= searchLimit) break;
          const text = (h.text || '').toLowerCase();
          if (terms.every((t: string) => text.includes(t))) {
            const cid = SLUG_TO_ID[slug];
            const en = englishEdition.hadiths.find((e: any) => e.hadithnumber === h.hadithnumber);
            results.arabic.push(formatHadith(h, cid, slug, en));
          }
        }
        
        // English search (body contains terms)
        const engTerms = terms.filter((t: string) => /[a-z]/.test(t));
        if (engTerms.length > 0) {
          for (const h of englishEdition.hadiths) {
            if (results.english.length >= searchLimit) break;
            const body = (h.text || '').toLowerCase();
            if (engTerms.every((t: string) => body.includes(t))) {
              results.english.push({
                urn: '',
                body: h.text || '',
              });
            }
          }
        }
      } catch {
        // Skip collections that fail to load
        continue;
      }
    }
    
    return {
      arabic: results.arabic,
      english: results.english,
      total: results.arabic.length + results.english.length,
    };
  },

  async getStats(): Promise<any> {
    let totalCollectionCount = Object.keys(COLLECTION_MAP).length;
    let totalBooks = totalCollectionCount;
    let totalHadiths = 0;
    
    for (const slug of Object.values(COLLECTION_MAP)) {
      try {
        const edition = await fetchEdition(slug, 'ara');
        totalHadiths += edition.hadiths.length;
      } catch {
        continue;
      }
    }
    
    return {
      collection_count: totalCollectionCount,
      total_books: totalBooks,
      total_chapters: totalHadiths,
    };
  },
};

function formatHadith(h: any, collectionId: number, slug: string, english: any): any {
  if (!h) return null;
  const hadithNumber = h.hadithnumber;
  const urn = `${collectionId}.${hadithNumber}`;
  const text = h.text || '';
  
  return {
    urn,
    collection_id: collectionId,
    book_id: 1,
    display_number: hadithNumber,
    order_in_book: hadithNumber,
    chapter_id: h.chapter?.id || null,
    narrator_prefix: '',
    content: text,
    narrator_postfix: '',
    narrator_prefix_diacless: '',
    content_diacless: text.replace(/[\u064B-\u065F\u0670]/g, ''),
    narrator_postfix_diacless: '',
    comments: '',
    grades: formatGrades(h.grades),
    narrators: '',
    related_hadiths: '',
    english: english ? {
      urn: `${collectionId}.${english.hadithnumber}`,
      book_id: 1,
      hadith_number: english.hadithnumber,
      narrator_prefix: '',
      body: english.text || '',
    } : null,
  };
}

function formatGrades(grades: any[]): string {
  if (!grades || grades.length === 0) return '';
  // Return Arabic grades if present
  const arabicGrades = grades
    .filter((g: any) => /[\u0600-\u06FF]/.test(g.grade || ''))
    .map((g: any) => g.grade)
    .join('، ');
  if (arabicGrades) return arabicGrades;
  // Fallback
  return grades.map((g: any) => g.grade || '').join(', ');
}
