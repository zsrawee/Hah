import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const collectionId = searchParams.get('collection') ? parseInt(searchParams.get('collection')!) : undefined;
    const limit = parseInt(searchParams.get('limit') || '30');
    
    if (!query.trim()) {
      return NextResponse.json({ results: { arabic: [], english: [] }, count: 0 });
    }
    
    const results = await hadithAPI.search(query, collectionId, limit);
    return NextResponse.json({ results, count: results.total });
  } catch (err: any) {
    console.error('API Error (search):', err);
    return NextResponse.json({ error: 'An error occurred while searching.' }, { status: 500 });
  }
}
