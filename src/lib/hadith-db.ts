import HadithDB from 'hadith';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: HadithDB | null = null;
let isConnecting = false;
let connectPromise: Promise<void> | null = null;

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

/** URL for downloading the hadith database (CDN fallback) */
const DB_DOWNLOAD_URL = process.env.HADITH_DB_URL || 'https://cdn.jsdelivr.net/npm/hadith@1.3.0/data/hadith.db';

/** Check if a file exists */
function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** Download the DB file to a writable location (e.g. /tmp) */
async function downloadDB(targetPath: string): Promise<void> {
  console.log('⏳ Downloading hadith database from CDN...');
  const response = await fetch(DB_DOWNLOAD_URL);
  if (!response.ok) throw new Error(`Failed to download DB: ${response.status} ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  console.log('✅ Hadith DB downloaded to', targetPath);
}

/** Resolve the database path, downloading if needed */
async function resolveDBPath(): Promise<string> {
  // 1. Check the default package location
  const localPaths = [
    path.join(process.cwd(), 'node_modules', 'hadith', 'data', 'hadith.db'),
    path.join(__dirname, 'data', 'hadith.db'),
  ];
  
  for (const p of localPaths) {
    if (fileExists(p)) {
      console.log('✅ Found local DB at', p);
      return p;
    }
  }
  
  // 2. Check /tmp cache (Vercel persists /tmp during active deploys)
  const cachePath = path.join(os.tmpdir(), 'hadith-cache', 'hadith.db');
  if (fileExists(cachePath)) {
    console.log('✅ Found cached DB at', cachePath);
    return cachePath;
  }
  
  // 3. Download from CDN
  console.log('⚠️ Local DB not found, downloading from CDN...');
  await downloadDB(cachePath);
  return cachePath;
}

async function getDB(): Promise<HadithDB> {
  if (db) return db;
  
  if (!isConnecting) {
    isConnecting = true;
    connectPromise = (async () => {
      try {
        const dbPath = await resolveDBPath();
        const instance = new HadithDB(dbPath);
        await instance.connect();
        db = instance;
        console.log('✅ Hadith DB connected from', dbPath);
      } catch (err) {
        console.error('❌ DB connection failed:', err);
        throw err;
      } finally {
        isConnecting = false;
      }
    })();
  }
  
  await connectPromise;
  return db!;
}

// Helper to query English hadiths directly (fixes type issues)
async function queryEnglishByUrn(urn: string) {
  const instance = await getDB();
  const sqlDb = (instance as any).db;
  if (!sqlDb) return null;
  
  try {
    const stmt = sqlDb.prepare(`
      SELECT 
        c0 as arabic_urn,
        c1 as urn,
        c2 as collection_id,
        c3 as narrator_prefix,
        c4 as content,
        c5 as narrator_postfix,
        c6 as comments,
        c7 as grades,
        c8 as reference
      FROM hadith_en_content 
      WHERE c0 = ?
    `);
    stmt.bind([parseInt(urn)]);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch {
    return null;
  }
}

// Search Arabic hadith content
async function searchArabicContent(query: string, collectionId?: number, limit = 30, offset = 0) {
  const instance = await getDB();
  const sqlDb = (instance as any).db;
  if (!sqlDb) return [];
  
  const likeQuery = `%${query.replace(/'/g, "''")}%`;
  
  let sql = `
    SELECT 
      c0 as urn, c1 as collection_id, c2 as book_id,
      c3 as display_number, c4 as order_in_book,
      c6 as narrator_prefix, c7 as content,
      c8 as narrator_postfix, c13 as grades
    FROM hadith_content
    WHERE c7 LIKE ?
  `;
  const params: any[] = [likeQuery];
  
  if (collectionId) {
    sql += ' AND c1 = ?';
    params.push(collectionId);
  }
  sql += ' ORDER BY c1, c4 LIMIT ? OFFSET ?';
  params.push(limit + 1, offset);
  
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results.slice(0, limit);
}

// Search English hadith content
async function searchEnglishContent(query: string, collectionId?: number, limit = 30, offset = 0) {
  const instance = await getDB();
  const sqlDb = (instance as any).db;
  if (!sqlDb) return [];
  
  const likeQuery = `%${query.replace(/'/g, "''")}%`;
  
  let sql = `
    SELECT 
      c0 as arabic_urn, c1 as urn, c2 as collection_id,
      c3 as narrator_prefix, c4 as content,
      c5 as narrator_postfix, c7 as grades, c8 as reference
    FROM hadith_en_content
    WHERE c4 LIKE ?
  `;
  const params: any[] = [likeQuery];
  
  if (collectionId) {
    sql += ' AND c2 = ?';
    params.push(collectionId);
  }
  sql += ' ORDER BY c2, c0 LIMIT ? OFFSET ?';
  params.push(limit + 1, offset);
  
  const stmt = sqlDb.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results.slice(0, limit);
}

export const hadithAPI = {
  getDB,
  
  async getCollections() {
    const instance = await getDB();
    return instance.getCollections();
  },
  
  async getCollection(id: number) {
    const instance = await getDB();
    return instance.getCollection(id);
  },
  
  async getBooks(collectionId: number) {
    const instance = await getDB();
    return instance.getBooks(collectionId);
  },
  
  async getHadiths(collectionId: number, options?: { limit?: number; offset?: number; bookId?: number }) {
    const instance = await getDB();
    const hadiths = await instance.getHadithsByCollection(collectionId, {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      bookId: options?.bookId || null,
    });
    
    const enHadiths = [];
    for (const h of hadiths) {
      const en = await queryEnglishByUrn(h.urn);
      if (en) enHadiths.push(en);
    }
    
    return { arabic: hadiths, english: enHadiths };
  },
  
  async getHadithByUrn(urn: string) {
    const instance = await getDB();
    let arabic = await instance.getHadithByUrn(urn);
    
    // Fallback to direct query
    if (!arabic) {
      const sqlDb = (instance as any).db;
      if (sqlDb) {
        const stmt = sqlDb.prepare(`
          SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
                 c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix, c7 as content,
                 c8 as narrator_postfix, c13 as grades, c14 as narrators, c12 as comments
          FROM hadith_content WHERE c0 = ?
        `);
        stmt.bind([parseInt(urn)]);
        if (stmt.step()) arabic = stmt.getAsObject();
        stmt.free();
      }
    }
    
    const english = await queryEnglishByUrn(urn);
    return { arabic, english };
  },
  
  async getRandomHadith(collectionId?: number) {
    const instance = await getDB();
    const sqlDb = (instance as any).db;
    if (!sqlDb) throw new Error('DB not connected');

    // Fast random: count rows, pick offset, LIMIT 1
    // ORDER BY RANDOM() scans the entire table — very slow for 160K rows
    let countSql = 'SELECT COUNT(*) as cnt FROM hadith_content';
    let querySql = `
      SELECT c0 as urn, c1 as collection_id, c2 as book_id, c3 as display_number,
             c4 as order_in_book, c5 as chapter_id, c6 as narrator_prefix, c7 as content,
             c8 as narrator_postfix, c9 as narrator_prefix_diacless,
             c10 as content_diacless, c11 as narrator_postfix_diacless,
             c12 as comments, c13 as grades, c14 as narrators, c15 as related_hadiths
      FROM hadith_content
    `;
    const params: any[] = [];
    
    if (collectionId !== undefined && collectionId !== null) {
      const where = ' WHERE c1 = ?';
      countSql += where;
      querySql += where;
      params.push(collectionId);
    }

    const countStmt = sqlDb.prepare(countSql);
    if (params.length) countStmt.bind(params);
    let totalRows = 0;
    if (countStmt.step()) {
      totalRows = countStmt.getAsObject().cnt;
    }
    countStmt.free();

    if (totalRows === 0) return { arabic: null, english: null };

    const offset = Math.floor(Math.random() * totalRows);
    querySql += ' LIMIT 1 OFFSET ?';
    
    const stmt = sqlDb.prepare(querySql);
    stmt.bind([...params, offset]);
    
    let arabic = null;
    if (stmt.step()) {
      arabic = stmt.getAsObject();
    }
    stmt.free();

    let english = null;
    if (arabic) english = await queryEnglishByUrn(arabic.urn);
    return { arabic, english };
  },
  
  async search(query: string, collectionId?: number, limit = 30) {
    const [arabic, english] = await Promise.all([
      searchArabicContent(query, collectionId, limit),
      searchEnglishContent(query, collectionId, limit),
    ]);
    return { arabic, english, total: arabic.length + english.length };
  },
  
  async getStats() {
    const instance = await getDB();
    const info = await instance.getInfo();
    return info;
  },
};
