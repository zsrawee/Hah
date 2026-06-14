/**
 * Copy the hadith database from node_modules to public/data/
 * This ensures the DB is available as a static asset on Vercel
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'hadith', 'data', 'hadith.db');
const destDir = path.join(__dirname, '..', 'public', 'data');
const dest = path.join(destDir, 'hadith.db');

// Check if source exists
if (!fs.existsSync(src)) {
  console.error('❌ Source hadith DB not found at:', src);
  process.exit(1);
}

// Create destination directory
fs.mkdirSync(destDir, { recursive: true });

// Copy file
const srcSize = fs.statSync(src).size;
fs.copyFileSync(src, dest);
const destSize = fs.statSync(dest).size;

console.log(`✅ Hadith DB copied: ${(srcSize / 1024 / 1024).toFixed(1)}MB → public/data/hadith.db`);
