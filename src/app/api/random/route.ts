import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get('collection') ? parseInt(searchParams.get('collection')!) : undefined;
    
    const data = await hadithAPI.getRandomHadith(collectionId, undefined);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (random):', err);
    return NextResponse.json({ error: 'An error occurred while fetching a random hadith.' }, { status: 500 });
  }
}
