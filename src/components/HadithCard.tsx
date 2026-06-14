"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Hadith } from "@/types/hadith";
import { useTranslations, useLocale } from "next-intl";
import { useFavorites } from "@/context/FavoritesContext";
import { useHistory } from "@/context/HistoryContext";
import { extractSanad, extractMatn, getGradeInfo, getHadithNumber, getReference } from "@/lib/hadithUtils";

interface HadithCardProps {
  hadith: Hadith;
  index?: number;
  detailed?: boolean;
  showIndex?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

const collectionNames: Record<string, string> = {
  "sahih-bukhari": "Sahih al-Bukhari",
  "sahih-muslim": "Sahih Muslim",
  "sunan-abu-dawud": "Sunan Abu Dawud",
  "sunan-ibn-majah": "Sunan Ibn Majah",
  "jami-at-tirmidhi": "Jami at-Tirmidhi",
  "sunan-an-nasai": "Sunan an-Nasa'i",
};

const collectionNamesAr: Record<string, string> = {
  "sahih-bukhari": "صحيح البخاري",
  "sahih-muslim": "صحيح مسلم",
  "sunan-abu-dawud": "سنن أبي داود",
  "sunan-ibn-majah": "سنن ابن ماجه",
  "jami-at-tirmidhi": "جامع الترمذي",
  "sunan-an-nasai": "سنن النسائي",
};

function normalizeHadith(hadith: Hadith) {
  const englishText = hadith.english?.text || hadith.english?.content || "";
  const extractText = (text: string) => {
    const match = text.match(/:\s*([\s\S]+)/);
    return match ? match[1].trim() : text.trim();
  };

  return {
    cleanArabic: extractMatn(hadith),
    cleanEnglish: extractText(englishText),
    sanad: extractSanad(hadith),
    gradeInfo: getGradeInfo(hadith),
    rangeStr: getHadithNumber(hadith),
    narratorArabic: hadith.narratorArabic || hadith.narrator,
  };
}

export default function HadithCard({
  hadith,
  detailed = false,
  onClick,
}: HadithCardProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const { addHadith: addToHistory, isHadithRead, markAsRead } = useHistory();
  const { addHadith: addToFavorites, isHadithSaved } = useFavorites();

  const collectionId = hadith.collection || hadith.collectionId || "unknown";
  const collectionName = isRTL
    ? collectionNamesAr[collectionId] || collectionId
    : collectionNames[collectionId] || collectionId;

  const { cleanArabic, cleanEnglish, rangeStr, narratorArabic, sanad, gradeInfo } = normalizeHadith(hadith);
  const reference = getReference(hadith);

  const isRead = isHadithRead(hadith.collectionId, hadith.hadithNumber);
  const isSaved = isHadithSaved(hadith.collectionId, hadith.hadithNumber);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = isRTL ? cleanArabic : cleanEnglish;
    await navigator.clipboard.writeText(text).catch(() => {});
  }, [isRTL, cleanArabic, cleanEnglish]);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addToFavorites(hadith);
  }, [addToFavorites, hadith]);

  return (
    <article
      className={`
        rounded-xl border transition-all duration-200 cursor-pointer
        ${detailed
          ? "bg-gray-900 border-gray-800"
          : "bg-gray-900/50 border-gray-800/50 hover:border-gray-700 hover:bg-gray-900"
        }
        ${isRead ? "border-l-2 border-l-amber-500" : ""}
      `}
      onClick={onClick}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-md">
              {collectionName}
            </span>
            {rangeStr && (
              <span className="text-xs text-gray-500">#{rangeStr}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); handleFavorite(e); }}
              className={`p-1.5 rounded-lg transition-colors ${
                isSaved ? "text-amber-400 bg-amber-400/10" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              <svg className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </button>
            {detailed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/speech-practice?urn=${hadith.arabic?.urn || hadith.arabic?.c0}`);
                }}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Arabic Text */}
        {cleanArabic && (
          <div className={`mb-4 ${detailed ? "" : "line-clamp-3"}`}>
            <p
              dir="rtl"
              className="text-xl md:text-2xl font-arabic leading-[2] text-white"
            >
              {cleanArabic}
            </p>
          </div>
        )}

        {/* Grade (Sahih / Da'if / Hasan) */}
        {gradeInfo.text && (
          <div className="mb-3 flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-md ${gradeInfo.colorClass}`}>
              {gradeInfo.text}
            </span>
          </div>
        )}

        {/* Sanad (chain of narration) */}
        {sanad && detailed && (
          <div className="mb-3 px-3 py-2 bg-gray-800/50 rounded-lg">
            <span className="text-xs text-gray-500 block mb-1">{t("hadith.chain")}</span>
            <span className="text-sm text-gray-300 leading-relaxed" dir="rtl">
              {sanad}
            </span>
          </div>
        )}

        {/* Reference */}
        {reference && detailed && (
          <div className="mb-3 px-3 py-2 bg-gray-800/50 rounded-lg">
            <span className="text-xs text-gray-500 block mb-1">{t("hadith.reference")}</span>
            <span className="text-sm text-gray-300">{reference}</span>
          </div>
        )}

        {/* Narrator */}
        {narratorArabic && detailed && (
          <div className="mb-3 px-3 py-2 bg-gray-800/50 rounded-lg">
            <span className="text-xs text-gray-500 mr-2">{t("hadith.narrator")}</span>
            <span className="text-sm text-gray-300">{narratorArabic}</span>
          </div>
        )}

        {/* English Translation */}
        {cleanEnglish && (
          <div className={`${detailed ? "mt-4 pt-4 border-t border-gray-800" : "line-clamp-2"}`}>
            <p className={`text-sm text-gray-400 leading-relaxed ${!detailed && !expanded ? "line-clamp-2" : ""}`}>
              {cleanEnglish}
            </p>
          </div>
        )}

        {/* Actions */}
        {detailed && (
          <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleCopy(e); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t("hadith.copy")}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(hadith.collectionId, hadith.hadithNumber);
                addToHistory(hadith);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                isRead
                  ? "text-amber-400 bg-amber-400/10"
                  : "text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {isRead ? t("hadith.markedRead") : t("hadith.markRead")}
            </button>
          </div>
        )}

        {/* Expand */}
        {!detailed && cleanEnglish && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? t("hadith.showLess") : t("hadith.showMore")}
          </button>
        )}
      </div>
    </article>
  );
}
