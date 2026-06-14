import { NextRequest, NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const collectionId = searchParams.get('collection') ? parseInt(searchParams.get('collection')!) : undefined;
    const limit = parseInt(searchParams.get('limit') || '30');
    
    if (!query.trim()) {
      return NextResponse.json({ results: [], count: 0 });
    }
    
    const { arabic, english, total } = await hadithAPI.search(query, collectionId, limit);
    
    // Convert flat search results into Hadith structure with arabic/english sub-objects
    const combined: any[] = [
      ...arabic.map((h: any) => ({
        urn: h.urn,
        collectionId: h.collection_id,
        display_number: h.display_number,
        arabic: {
          urn: h.urn,
          collection_id: h.collection_id,
          book_id: h.book_id,
          display_number: h.display_number,
          narrator_prefix: h.narrator_prefix || '',
          content: h.content || '',
          narrator_postfix: h.narrator_postfix || '',
          grades: h.grades || '',
        },
      })),
      ...english.map((h: any) => ({
        urn: h.arabic_urn,
        collectionId: h.collection_id,
        english: {
          urn: h.arabic_urn,
          collection_id: h.collection_id,
          narrator_prefix: h.narrator_prefix || '',
          content: h.content || '',
          narrator_postfix: h.narrator_postfix || '',
          grades: h.grades || '',
          reference: h.reference || '',
        },
      })),
    ];
    return NextResponse.json({ results: combined, count: total });
  } catch (err: any) {
    console.error('API Error (search):', err);
    return NextResponse.json({ error: 'An error occurred while searching.' }, { status: 500 });
  }
}
