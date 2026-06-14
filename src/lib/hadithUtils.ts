import { Hadith } from "@/types/hadith";

/**
 * Extract the sanad (chain of narration) from a hadith.
 *
 * IMPORTANT: We ONLY use what is stored in the database.
 * We NEVER extract or guess a chain from the content.
 * If there is no narrator_prefix in the DB → no sanad shown.
 */
export function extractSanad(hadith: Hadith): string {
  const prefix = (hadith.arabic?.narrator_prefix || "").trim();
  const postfix = (hadith.arabic?.narrator_postfix || "").trim();

  if (prefix && postfix) return `${prefix} ${postfix}`;
  if (prefix) return prefix;
  if (postfix) return postfix;
  return "";
}

/**
 * Get the main text (matn) for speech practice display.
 * Strips the embedded sanad prefix from content when narrator_prefix
 * is not stored separately (just for clean UI presentation).
 */
export function extractMatn(hadith: Hadith): string {
  const content = hadith.arabic?.content || hadith.arabic?.text || "";
  if (!content) return "";

  // If narrator_prefix exists separately, content is already pure matn
  if (hadith.arabic?.narrator_prefix) return content.trim();

  // Otherwise try to strip the leading sanad (chain words) from content
  // for cleaner display. This is just UI formatting, not adding data.
  const cleaned = content
    .replace(/^[\s\u200B\u200C\u200D\uFEFF]+/, "")
    .trim();

  // Look for first ':' and take everything after (most common pattern)
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx > 0 && colonIdx < cleaned.length - 1) {
    return cleaned.substring(colonIdx + 1).trim();
  }

  return cleaned;
}

/**
 * Get the hadith grade from the database ONLY.
 *
 * IMPORTANT: We are only narrators (ناقلون). We NEVER:
 *   - Infer a grade from the collection
 *   - Fall back to English grades
 *   - Add any grade that isn't in the database
 *
 * If the Arabic grade exists in the DB → show it as-is.
 * If not → show nothing.
 */
export function getGradeInfo(hadith: Hadith): {
  text: string;
  colorClass: string;
} {
  const grade = (hadith.arabic?.grades || "").trim();

  if (!grade) return { text: "", colorClass: "" };

  if (grade.includes("صحيح")) {
    return { text: grade, colorClass: "bg-emerald-500/10 text-emerald-400" };
  }

  if (grade.includes("ضعيف")) {
    return { text: grade, colorClass: "bg-red-500/10 text-red-400" };
  }

  if (grade.includes("حسن")) {
    return { text: grade, colorClass: "bg-amber-500/10 text-amber-400" };
  }

  // Grade exists but unrecognized — still show it as-is
  return { text: grade, colorClass: "bg-gray-700/50 text-gray-400" };
}

/**
 * Get the hadith number display string.
 */
export function getHadithNumber(hadith: Hadith): string {
  if (hadith.hadithNumber?.[0]) {
    return hadith.hadithNumber.length === 1
      ? String(hadith.hadithNumber[0])
      : `${hadith.hadithNumber[0]}-${hadith.hadithNumber[hadith.hadithNumber.length - 1]}`;
  }
  return String(hadith.id || hadith.arabic?.urn || "");
}

/**
 * Get full reference string for the hadith (collection name + number).
 */
export function getReference(hadith: Hadith): string {
  const eng = hadith.english?.reference || "";
  // Extract just the main reference (first line)
  if (eng) {
    const firstLine = eng.split("\n")[0].trim();
    return firstLine;
  }
  return "";
}
