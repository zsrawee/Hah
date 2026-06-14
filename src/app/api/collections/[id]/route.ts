import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const collection = await hadithAPI.getCollection(parseInt(params.id));
    if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(collection);
  } catch (err: any) {
    console.error('API Error (collection by id):', err);
    return NextResponse.json({ error: 'An error occurred while fetching the collection.' }, { status: 500 });
  }
}
