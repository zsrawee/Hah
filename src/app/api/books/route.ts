import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET() {
  try {
    const collections = await hadithAPI.getCollections();

    // getBooks() without collectionId returns all books with hadithCount
    const books = (await hadithAPI.getBooks()) as Array<{
      id: number;
      name: string;
      bookNumber: number;
      hadithCount: number;
      collection_id?: number;
    }>;

    // Build a lookup from collection_id → hadithCount
    const hadithCountMap = new Map<number, number>();
    for (const book of books) {
      if (book.collection_id !== undefined) {
        hadithCountMap.set(book.collection_id, book.hadithCount);
      }
    }

    const result = collections.map((c) => ({
      id: String(c.id),
      name: c.title_en || c.title,
      hadithCount: hadithCountMap.get(c.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error (books):', err);
    return NextResponse.json({ error: 'An error occurred while fetching collections.' }, { status: 500 });
  }
}
