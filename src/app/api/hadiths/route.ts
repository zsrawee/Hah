import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionId = parseInt(searchParams.get('collection') || '1');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = searchParams.has('offset') 
      ? parseInt(searchParams.get('offset')!) 
      : (page - 1) * limit;
    const bookId = searchParams.get('book') ? parseInt(searchParams.get('book')!) : undefined;
    
    const data = await hadithAPI.getHadiths(collectionId, { limit, offset, bookId });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (hadiths):', err);
    return NextResponse.json({ error: 'An error occurred while fetching hadiths.' }, { status: 500 });
  }
}
