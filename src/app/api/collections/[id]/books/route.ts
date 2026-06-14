import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const books = await hadithAPI.getBooks(parseInt(params.id));
    return NextResponse.json(books);
  } catch (err: any) {
    console.error('API Error (books by collection):', err);
    return NextResponse.json({ error: 'An error occurred while fetching books.' }, { status: 500 });
  }
}
