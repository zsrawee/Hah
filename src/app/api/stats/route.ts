import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET() {
  try {
    const stats = await hadithAPI.getStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('API Error (stats):', err);
    return NextResponse.json({ error: 'An error occurred while fetching statistics.' }, { status: 500 });
  }
}
