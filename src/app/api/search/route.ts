import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

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

function resolveCollectionId(input: string | null): number | undefined {
  if (!input) return undefined;
  // If it's already a numeric ID, parse directly
  if (/^\d+$/.test(input)) return parseInt(input);
  // Otherwise look up in the slug map
  const lower = input.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return LONG_SLUG_TO_ID[lower] || undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const collectionId = resolveCollectionId(searchParams.get('collection'));
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!query.trim()) {
      return NextResponse.json({ results: [], count: 0 });
    }

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
        // English already has Arabic counterpart – set the english field
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
        // English-only result – still include it so it shows
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
    // Exclude total to avoid confusion – count = combined.length
    return NextResponse.json({ results: combined, count: combined.length });
  } catch (err: any) {
    console.error('API Error (search):', err);
    return NextResponse.json({ error: 'An error occurred while searching.' }, { status: 500 });
  }
}
