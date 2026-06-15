import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';

const VALID_COLLECTION_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

export async function GET(req: NextRequest) {
  try {
    // Rate limiting - random endpoint is called frequently
    const ip = getClientIp(req);
    const { allowed } = rateLimit(`random:${ip}`, { max: 30, windowSeconds: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    
    // Validate collection ID (optional)
    let collectionId: number | undefined;
    if (searchParams.has('collection')) {
      const raw = searchParams.get('collection')!;
      collectionId = parseInt(raw, 10);
      if (isNaN(collectionId) || !VALID_COLLECTION_IDS.has(collectionId)) {
        return NextResponse.json({ error: 'Invalid collection ID. Must be 1-9.' }, { status: 400 });
      }
    }
    
    const data = await hadithAPI.getRandomHadith(collectionId, undefined);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (random):', err);
    return NextResponse.json({ error: 'An error occurred while fetching a random hadith.' }, { status: 500 });
  }
}
