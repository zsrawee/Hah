import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET() {
  try {
    const collections = await hadithAPI.getCollections();
    return NextResponse.json(collections);
  } catch (err: any) {
    console.error('API Error (collections):', err);
    return NextResponse.json({ error: 'An error occurred while fetching collections.' }, { status: 500 });
  }
}
