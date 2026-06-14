import { NextResponse } from 'next/server';
import { hadithAPI } from '@/lib/hadith-db';

export async function GET(_req: Request, { params }: { params: { urn: string } }) {
  try {
    const data = await hadithAPI.getHadithByUrn(params.urn);
    if (!data.arabic) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API Error (hadith by URN):', err);
    return NextResponse.json({ error: 'An error occurred while fetching the hadith.' }, { status: 500 });
  }
}
