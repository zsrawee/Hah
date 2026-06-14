/**
 * Hadith database access layer.
 * Uses sql.js directly (not the `hadith` npm package) to:
 * 1. Avoid bundling the 133MB data directory from the package on Vercel
 * 2. Properly configure WASM loading on Vercel serverless
 * 3. Support bundled DB file (public/data/) for zero-download cold starts
 */
import path from 'path';
import fs from 'fs';
import os from 'os';

let SQL: any = null;
let db: any = null;

const COLLECTION_NAMES: Record<number, { ar: string; en: string }> = {
  1: { ar: 'صحيح البخاري', en: 'Sahih al-Bukhari' },
  2: { ar: 'صحيح مسلم', en: 'Sahih Muslim' },
  3: { ar: 'سنن النسائي', en: "Sunan an-Nasa'i" },
  10: { ar: 'سنن أبي داود', en: 'Sunan Abi Dawud' },
  30: { ar: 'جامع الترمذي', en: 'Jami` at-Tirmidhi' },
  38: { ar: 'سنن ابن ماجه', en: 'Sunan Ibn Majah' },
  40: { ar: 'موطأ مالك', en: 'Muwatta Malik' },
  50: { ar: 'مسند أحمد', en: 'Musnad Ahmad' },
  101: { ar: 'الأربعون النووية', en: "An-Nawawi's 40 Hadith" },
  102: { ar: 'الأربعينات', en: 'Collections of Forty' },
  110: { ar: 'رياض الصالحين', en: 'Riyad as-Salihin' },
  113: { ar: 'مشكاة المصابيح', en: 'Mishkat al-Masabih' },
  115: { ar: 'الأدب المفرد', en: 'Al-Adab Al-Mufrad' },
  130: { ar: 'الشمائل المحمدية', en: "Ash-Shama'il Al-Muhammadiyah" },
  200: { ar: 'بلوغ المرام', en: 'Bulugh al-Maram' },
  300: { ar: 'حصن المسلم', en: 'Hisn al-Muslim' },
};

export function getCollectionName(id: number): { ar: string; en: string } {
  return COLLECTION_NAMES[id] || { ar: `المجموعة ${id}`, en: `Collection ${id}` };
}

export function getCollectionNames(): Record<number, { ar: string; en: string }> {
  return COLLECTION_NAMES;
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function getDBUrl(): string | null {
  if (process.env.HADITH_DB_URL) return process.env.HADITH_DB_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/data/hadith.db`;
  return null;
}

async function downloadDB(targetPath: string): Promise<void> {
  const url = getDBUrl();
  if (!url) throw new Error('No download URL configured');
  console.log('⏳ Downloading hadith database from', url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download DB: ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  console.log('✅ Hadith DB downloaded to', targetPath);
}

async function resolveDBPath(): Promise<string> {
  // 1. Check /tmp cache (warm starts)
  const cachePath = path.join(os.tmpdir(), 'hadith-cache', 'hadith.db');
  if (fileExists(cachePath)) {
    return cachePath;
  }

  // 2. Use bundled DB file (primary - works on both Vercel and local after prebuild)
  // The prebuild script copies node_modules/hadith/data/hadith.db → public/data/hadith.db
  // On Vercel, this path IS in the function bundle (single 133MB copy, under 250MB limit)
  const bundledPath = path.join(process.cwd(), 'public', 'data', 'hadith.db');
  if (fileExists(bundledPath)) {
    return bundledPath;
  }

  // 3. Download from URL (fallback if HADITH_DB_URL is set)
  if (getDBUrl()) {
    await downloadDB(cachePath);
    return cachePath;
  }

  throw new Error(
    'Hadith DB not found. Run "npm run prebuild" first. ' +
    'For Vercel: ensure prebuild script runs during build.'
  );
}

async function initDB(): Promise<void> {
  if (db) return;
  const dbp = await resolveDBPath();
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbp);
  db = new SQL.Database(buffer);
  console.log('✅ Hadith DB connected from', dbp);
}

function queryAll(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('Database not connected');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Format a raw hadith row from hadith_content table into a clean object.
 */
function formatHadith(row: any): any {
  if (!row) return null;
  return {
    urn: String(row.urn ?? ''),
    collection_id: parseInt(row.collection_id),
    book_id: parseInt(row.book_id),
    chapter_id: row.chapter_id ? parseInt(row.chapter_id) : null,
    display_number: parseFloat(row.display_number) || 0,
    order_in_book: parseInt(row.order_in_book) || 0,
    narrator_prefix: row.narrator_prefix || '',
    content: row.content || '',
    narrator_postfix: row.narrator_postfix || '',
    narrator_prefix_diacless: row.narrator_prefix_diacless || '',
    content_diacless: row.content_diacless || '',
    narrator_postfix_diacless: row.narrator_postfix_diacless || '',
    comments: row.comments || '',
    grades: row.grades || '',
    narrators: row.narrators || '',
    related_hadiths: row.related_hadiths || '',
  };
}

async function queryEnglishByUrn(urn: string): Promise<any | null> {
  if (!db) return null;
  try {
    const sql = 'SELECT c0 as urn, c1 as book_id, c2 as hadith_number, c3 as body FROM hadith_english WHERE c0 = ? LIMIT 1';
    return queryOne(sql, [urn]);
  } catch {
    return null;
  }
}

export const hadithAPI = {
  async ensureConnected(): Promise<void> {
    await initDB();
  },

  async getCollections(): Promise<any[]> {
    await initDB();
    return queryAll('SELECT * FROM collection');
  },

  async getCollection(id: number): Promise<any | null> {
    await initDB();
    return queryOne('SELECT * FROM collection WHERE id = ?', [id]);
  },

  async getBooks(collectionId?: number): Promise<any[]> {
    await initDB();
    if (collectionId !== undefined) {
      return queryAll('SELECT * FROM book WHERE collection_id = ? ORDER BY id', [collectionId]);
    }
    return queryAll('SELECT * FROM book ORDER BY id');
  },

  async getHadiths(
    collectionId: number,
    options: { limit?: number; offset?: number; bookId?: number } = {}
  ): Promise<{ hadiths: any[]; total: number }> {
    await initDB();

    let countSql = 'SELECT COUNT(*) as total FROM hadith_content WHERE c1 = ?';
    const countParams: any[] = [collectionId];
    if (options.bookId) {
      countSql += ' AND c2 = ?';
      countParams.push(options.bookId);
    }
    const countResult = queryOne(countSql, countParams);
    const total = countResult?.total || 0;

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    let dataSql = `
      SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
             c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix,
             c7 as content, c8 as narrator_postfix, c9 as narrator_prefix_diacless,
             c10 as content_diacless, c11 as narrator_postfix_diacless,
             c12 as comments, c13 as grades, c14 as narrators, c15 as related_hadiths
      FROM hadith_content WHERE c1 = ?
    `;
    const dataParams: any[] = [collectionId];
    if (options.bookId) {
      dataSql += ' AND c2 = ?';
      dataParams.push(options.bookId);
    }
    dataSql += ' ORDER BY c4 LIMIT ? OFFSET ?';
    dataParams.push(limit, offset);

    const rows = queryAll(dataSql, dataParams);
    const hadiths = rows.map(formatHadith);
    const hadithsWithEnglish = await Promise.all(
      hadiths.map(async (h) => {
        const en = h.urn ? await queryEnglishByUrn(h.urn) : null;
        return { ...h, english: en };
      })
    );

    return { hadiths: hadithsWithEnglish, total };
  },

  async getHadithByUrn(urn: string | number): Promise<any | null> {
    await initDB();
    const sql = `
      SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
             c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix,
             c7 as content, c8 as narrator_postfix, c9 as narrator_prefix_diacless,
             c10 as content_diacless, c11 as narrator_postfix_diacless,
             c12 as comments, c13 as grades, c14 as narrators, c15 as related_hadiths
      FROM hadith_content WHERE c0 = ? LIMIT 1
    `;
    const row = queryOne(sql, [String(urn)]);
    if (!row) return null;
    const hadith = formatHadith(row);
    const en = hadith.urn ? await queryEnglishByUrn(hadith.urn) : null;
    return { ...hadith, english: en };
  },

  async getRandomHadith(collectionId?: number, excludeUrn?: string): Promise<any | null> {
    await initDB();

    let countSql = 'SELECT COUNT(*) as cnt FROM hadith_content';
    const countParams: any[] = [];
    if (collectionId) { countSql += ' WHERE c1 = ?'; countParams.push(collectionId); }
    const cnt = queryOne(countSql, countParams);
    const total = cnt?.cnt || 0;
    if (total === 0) return null;

    for (let attempt = 0; attempt < 100; attempt++) {
      const offset = Math.floor(Math.random() * total);
      let sql = `
        SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
               c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix,
               c7 as content, c8 as narrator_postfix, c9 as narrator_prefix_diacless,
               c10 as content_diacless, c11 as narrator_postfix_diacless,
               c12 as comments, c13 as grades, c14 as narrators, c15 as related_hadiths
        FROM hadith_content
      `;
      const params: any[] = [];
      if (collectionId) { sql += ' WHERE c1 = ?'; params.push(collectionId); }
      sql += ' LIMIT 1 OFFSET ?';
      params.push(offset);

      const row = queryOne(sql, params);
      if (!row) return null;

      const hadith = formatHadith(row);
      if (excludeUrn && hadith.urn === excludeUrn) continue;

      const en = hadith.urn ? await queryEnglishByUrn(hadith.urn) : null;
      return { ...hadith, english: en };
    }
    return null;
  },

  async search(
    query: string,
    collectionId?: number,
    limit?: number
  ): Promise<{ arabic: any[]; english: any[]; total: number }> {
    await initDB();
    const searchLimit = limit || 20;

    // Arabic search by diacritic-less content
    const arabicTerms = query.split(/[\s,]+/).filter((t) => t.length > 0).map((t) => `%${t}%`);

    let arabicSql = `
      SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
             c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix,
             c7 as content, c8 as narrator_postfix, c9 as narrator_prefix_diacless,
             c10 as content_diacless, c11 as narrator_postfix_diacless,
             c12 as comments, c13 as grades, c14 as narrators, c15 as related_hadiths
      FROM hadith_content WHERE 1=1
    `;
    const arabicParams: any[] = [];
    for (const term of arabicTerms) {
      arabicSql += ' AND c10 LIKE ?';
      arabicParams.push(term);
    }
    if (collectionId) { arabicSql += ' AND c1 = ?'; arabicParams.push(collectionId); }
    arabicSql += ' LIMIT ?';
    arabicParams.push(searchLimit);

    const arabicRows = queryAll(arabicSql, arabicParams).map(formatHadith);

    // English search
    const englishTerms = query.split(/[\s,]+/).filter((t) => /[a-zA-Z]/.test(t)).map((t) => `%${t}%`);
    let englishHadiths: any[] = [];
    if (englishTerms.length > 0) {
      let engSql = 'SELECT c0 as urn, c1 as book_id, c2 as hadith_number, c3 as body FROM hadith_english WHERE 1=1';
      const engParams: any[] = [];
      for (const term of englishTerms) {
        engSql += ' AND c3 LIKE ?';
        engParams.push(term);
      }
      if (collectionId) {
        engSql += ' AND c0 IN (SELECT c0 FROM hadith_content WHERE c1 = ?)';
        engParams.push(collectionId);
      }
      engSql += ' LIMIT ?';
      engParams.push(searchLimit);
      englishHadiths = queryAll(engSql, engParams);
    }

    return {
      arabic: arabicRows,
      english: englishHadiths,
      total: arabicRows.length + englishHadiths.length,
    };
  },

  async getStats(): Promise<any> {
    await initDB();
    const collectionCount = queryOne('SELECT COUNT(*) as cnt FROM collection')?.cnt || 0;
    const bookCount = queryOne('SELECT COUNT(*) as cnt FROM book')?.cnt || 0;
    const hadithCount = queryOne('SELECT COUNT(*) as cnt FROM hadith_content')?.cnt || 0;
    return {
      collection_count: collectionCount,
      total_books: bookCount,
      total_chapters: hadithCount,
    };
  },
};
