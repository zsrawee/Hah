import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';
import { rateLimit, getClientIp } from '@/lib/rate-limiter';

/**
 * Validates a hadith URN format: collectionId-hadithNumber (e.g. "1-1" or "1-100")
 * Collection IDs: 1-9, hadith numbers: 1-99999
 */
const URN_REGEX = /^([1-9])-([1-9]\d{0,4})$/;

export async function GET(req: NextRequest, { params }: { params: { urn: string } }) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed } = rateLimit(`urn:${ip}`, { max: 120, windowSeconds: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    // Validate URN format
    const { urn } = params;
    if (!urn || typeof urn !== 'string') {
      return NextResponse.json({ error: 'Invalid URN parameter.' }, { status: 400 });
    }

    const match = urn.match(URN_REGEX);
    if (!match) {
      return NextResponse.json({ 
        error: 'Invalid URN format. Expected format: collectionId-hadithNumber (e.g. "1-1").' 
      }, { status: 400 });
    }

    const data = await hadithAPI.getHadithByUrn(urn);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (hadith by URN):', err);
    return NextResponse.json({ error: 'An error occurred while fetching the hadith.' }, { status: 500 });
  }
}
