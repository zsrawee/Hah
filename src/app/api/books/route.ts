import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

// The COLLECTION_NAMES map imported from hadith-db is internal.
// We use getCollections() for the list, then add hadithCount from getBooks().
export async function GET() {
  try {
    const collections = await hadithAPI.getCollections();
    const books = await hadithAPI.getBooks();

    // Merge collections with book data so the browse page gets name + hadithCount
    const bookMap = new Map(books.map(b => [b.collection_id, b]));

    const result = collections.map(c => ({
      id: String(c.id),
      name: c.title_en || c.title,
      hadithCount: bookMap.get(c.id)?.hadithCount ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error (books):', err);
    return NextResponse.json({ error: 'An error occurred while fetching collections.' }, { status: 500 });
  }
}