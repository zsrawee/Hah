import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';

// Map UI slugs to numeric collection IDs
const LONG_SLUG_TO_ID: Record<string, number> = {
  'sahih-bukhari': 1,
  'sahih-muslim': 2,
  'sunan-an-nasai': 3,
  'sunan-abu-dawud': 10,
  'jami-at-tirmidhi': 30,
  'sunan-ibn-majah': 38,
  'muwatta-malik': 40,
  'nawawi-40': 101,
  'bukhari': 1,
  'muslim': 2,
  'nasai': 3,
  'abudawud': 10,
  'tirmidhi': 30,
  'ibnmajah': 38,
  'malik': 40,
  'nawawi': 101,
};

// Map numeric collection IDs to UI slugs (for HadithCard lookup)
const ID_TO_SLUG: Record<number, string> = {
  1: 'sahih-bukhari',
  2: 'sahih-muslim',
  3: 'sunan-an-nasai',
  10: 'sunan-abu-dawud',
  30: 'jami-at-tirmidhi',
  38: 'sunan-ibn-majah',
  40: 'muwatta-malik',
  101: 'nawawi-40',
};

const VALID_COLLECTION_IDS = new Set(Object.keys(ID_TO_SLUG).map(Number));
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 100;

/**
 * Strip control characters and limit query length to prevent abuse.
 */
function sanitizeQuery(input: string): string {
  return input.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, MAX_QUERY_LENGTH);
}

function resolveCollectionId(input: string | null): number | undefined {
  if (!input) return undefined;
  // If it's already a numeric ID, parse directly
  if (/^\d+$/.test(input)) {
    const n = parseInt(input, 10);
    return VALID_COLLECTION_IDS.has(n) ? n : undefined;
  }
  // Otherwise look up in the slug map
  const lower = input.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return LONG_SLUG_TO_ID[lower] || undefined;
}

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed } = rateLimit(`search:${ip}`, { max: 30, windowSeconds: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const rawQuery = searchParams.get('q') || '';
    const query = sanitizeQuery(rawQuery);

    if (!query) {
      return NextResponse.json({ results: [], count: 0 });
    }

    // Validate limit
    const rawLimit = searchParams.get('limit') || '30';
    const limit = parseInt(rawLimit, 10);
    if (isNaN(limit) || limit < 1 || limit > MAX_LIMIT) {
      return NextResponse.json({ error: `Invalid limit. Must be between 1 and ${MAX_LIMIT}.` }, { status: 400 });
    }

    const collectionId = resolveCollectionId(searchParams.get('collection'));

    const { arabic, english, total } = await hadithAPI.search(query, collectionId, limit);

    // Merge Arabic and English results by URN so each hadith appears once
    // Also map collection_id to proper UI slug for HadithCard display
    const merged = new Map<string, any>();

    for (const h of arabic) {
      const key = `urn:${h.urn}`;
      const cid = h.collection_id;
      merged.set(key, {
        id: key,
        urn: h.urn,
        collectionId: cid,
        hadithNumber: h.urn || '',
        collection: ID_TO_SLUG[cid] || '',
        display_number: h.display_number,
        arabic: {
          urn: h.urn,
          collection_id: cid,
          book_id: h.book_id,
          display_number: h.display_number,
          narrator_prefix: h.narrator_prefix || '',
          content: h.content || '',
          narrator_postfix: h.narrator_postfix || '',
          grades: h.grades || '',
          text: h.content || '',
        },
        english: h.english || null,
      });
    }

    for (const h of english) {
      const key = `urn:${h.arabic_urn}`;
      const cid = h.collection_id;
      if (merged.has(key)) {
        merged.get(key)!.english = {
          urn: h.arabic_urn,
          arabic_urn: h.arabic_urn,
          collection_id: cid,
          narrator_prefix: h.narrator_prefix || '',
          content: h.content || '',
          narrator_postfix: h.narrator_postfix || '',
          grades: h.grades || '',
          reference: h.reference || '',
          text: h.content || '',
        };
      } else {
        merged.set(key, {
          id: key,
          urn: h.arabic_urn,
          collectionId: cid,
          hadithNumber: h.arabic_urn || '',
          collection: ID_TO_SLUG[cid] || '',
          display_number: h.display_number || '',
          arabic: null,
          english: {
            urn: h.arabic_urn,
            arabic_urn: h.arabic_urn,
            collection_id: cid,
            narrator_prefix: h.narrator_prefix || '',
            content: h.content || '',
            narrator_postfix: h.narrator_postfix || '',
            grades: h.grades || '',
            reference: h.reference || '',
            text: h.content || '',
          },
        });
      }
    }

    const combined = Array.from(merged.values());
    return NextResponse.json({ results: combined, count: combined.length });
  } catch (err: any) {
    console.error('API Error (search):', err);
    return NextResponse.json({ error: 'An error occurred while searching.' }, { status: 500 });
  }
}
