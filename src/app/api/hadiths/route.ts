import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';

// Valid collection IDs range (1-9)
const VALID_COLLECTION_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed } = rateLimit(`hadiths:${ip}`, { max: 120, windowSeconds: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    
    // Validate collection ID
    const rawCollection = searchParams.get('collection') || '1';
    const collectionId = parseInt(rawCollection, 10);
    if (isNaN(collectionId) || !VALID_COLLECTION_IDS.has(collectionId)) {
      return NextResponse.json({ error: 'Invalid collection ID. Must be 1-9.' }, { status: 400 });
    }

    // Validate page
    const rawPage = searchParams.get('page') || String(DEFAULT_PAGE);
    const page = parseInt(rawPage, 10);
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page number. Must be >= 1.' }, { status: 400 });
    }

    // Validate limit
    const rawLimit = searchParams.get('limit') || String(DEFAULT_LIMIT);
    const limit = parseInt(rawLimit, 10);
    if (isNaN(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
      return NextResponse.json({ error: `Invalid limit. Must be between ${MIN_LIMIT} and ${MAX_LIMIT}.` }, { status: 400 });
    }

    // Validate offset (optional)
    let offset: number | undefined;
    if (searchParams.has('offset')) {
      const rawOffset = searchParams.get('offset')!;
      offset = parseInt(rawOffset, 10);
      if (isNaN(offset) || offset < 0) {
        return NextResponse.json({ error: 'Invalid offset. Must be >= 0.' }, { status: 400 });
      }
    } else {
      offset = (page - 1) * limit;
    }

    // Validate book ID (optional)
    let bookId: number | undefined;
    if (searchParams.has('book')) {
      const rawBook = searchParams.get('book')!;
      bookId = parseInt(rawBook, 10);
      if (isNaN(bookId) || bookId < 1) {
        return NextResponse.json({ error: 'Invalid book ID.' }, { status: 400 });
      }
    }

    const data = await hadithAPI.getHadiths(collectionId, { limit, offset, bookId });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (hadiths):', err);
    return NextResponse.json({ error: 'An error occurred while fetching hadiths.' }, { status: 500 });
  }
}
