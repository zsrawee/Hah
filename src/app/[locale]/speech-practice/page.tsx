"use client";

import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter as useNextRouter } from "@/lib/navigation";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import SalawatButton from "@/components/SalawatButton";
import SpeechRecorder from "@/components/SpeechRecorder";
import { SpeechResult, analyzeArabicSpeech, analyzeArabicSpeechAudio } from "@/lib/speechAnalysis";
import { extractSanad, extractMatn, getGradeInfo, getReference } from "@/lib/hadithUtils";

function SpeechPracticeContent() {
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const searchParams = useSearchParams();
  const router = useNextRouter();

  const [hadith, setHadith] = useState<Hadith | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Hadith[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<SpeechResult | null>(null);

  const loadHadithByUrn = useCallback(async (urn: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hadiths/${urn}`);
      if (!res.ok) throw new Error("Not found");
      setHadith(await res.json());
      setError(null);
    } catch {
      setError("Could not load hadith.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRandomHadith = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/random");
      if (!res.ok) throw new Error('Failed to fetch');
      setHadith(await res.json());
    } catch {
      setError("Failed to load hadith");
    } finally {
      setLoading(false);
    }
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      setSearchResults(data.results || data || []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    const urn = searchParams.get("urn");
    if (urn) loadHadithByUrn(urn);
    else loadRandomHadith();
  }, [searchParams, loadHadithByUrn, loadRandomHadith]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => performSearch(searchQuery), 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, performSearch]);

  const handleRecordingComplete = async (spokenText: string) => {
    if (!hadith) return;
    setIsRecording(true);
    setError(null);
    setResult(null);
    try {
      const speechResult = await analyzeArabicSpeech(
        spokenText,
        extractMatn(hadith).replace(/\s+/g, " ").trim()
      );
      setResult(speechResult);
    } catch (err: any) {
      console.error('Speech analysis error:', err);
      setError('An error occurred during speech analysis. Please try again.');
    } finally {
      setIsRecording(false);
    }
  };

  const selectHadith = (selected: Hadith) => {
    setHadith(selected);
    setSearchResults([]);
    setSearchQuery("");
    setResult(null);
  };

  const arabicMatn = hadith ? extractMatn(hadith) : "";
  const sanad = hadith ? extractSanad(hadith) : "";
  const gradeInfo = hadith ? getGradeInfo(hadith) : { text: "", colorClass: "" };
  const reference = hadith ? getReference(hadith) : "";

  return (
    <>
      <Navbar />
      <SalawatButton />
      <main className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-white mb-2">{t("speech.title")}</h1>
          <p className="text-gray-400 mb-8">{t("speech.subtitle")}</p>

          {/* Search */}
          <div className="mb-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("speech.searchPlaceholder")}
              dir="auto"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            {searchResults.length > 0 && (
              <div className="mt-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectHadith(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-800/50 last:border-0 transition-colors"
                  >
                    <div className="text-sm text-gray-300 truncate">
                      {item.arabic?.content || item.arabic?.text || "No text"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hadith */}
          {loading ? (
            <div className="skeleton h-32" />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={loadRandomHadith}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : hadith ? (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                {/* Grade (Sahih / Da'if / Hasan) */}
                {gradeInfo.text && (
                  <div className="flex justify-center mb-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-md ${gradeInfo.colorClass}`}>
                      {gradeInfo.text}
                    </span>
                  </div>
                )}

                {/* Sanad (chain of narration) */}
                {sanad && (
                  <div className="mb-4 px-3 py-2 bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-500 text-center mb-1">
                      {t("hadith.chain")}
                    </p>
                    <p dir="rtl" className="text-sm text-gray-300 leading-relaxed text-center">
                      {sanad}
                    </p>
                  </div>
                )}

                {/* Main text (matn) */}
                {arabicMatn && (
                  <p dir="rtl" className="text-xl md:text-2xl font-arabic leading-[2] text-white text-center">
                    {arabicMatn}
                  </p>
                )}

                {/* Reference */}
                {reference && (
                  <div className="mt-4 px-3 py-2 bg-gray-800/30 rounded-lg">
                    <p className="text-xs text-gray-500 text-center">
                      {t("hadith.reference")}: {reference}
                    </p>
                  </div>
                )}

                {/* English translation */}
                {hadith.english && (
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    {hadith.english?.text || hadith.english?.content || ""}
                  </p>
                )}
              </div>

              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 text-center mb-4">{t("speech.recordingHint")}</h3>
                <SpeechRecorder
                  onRecordingComplete={handleRecordingComplete}
                  disabled={isRecording}
                />
              </div>

              {result && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-slide-up">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-full mb-3">
                      <span className="text-2xl font-bold text-amber-400">
                        {Math.round(result.accuracy)}%
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t("speech.results.title")}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-xs text-gray-500 mb-1">{t("speech.results.wordAccuracy")}</div>
                      <div className="text-lg font-semibold text-white">{Math.round(result.wordAccuracy)}%</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 text-center">
                      <div className="text-xs text-gray-500 mb-1">{t("speech.results.pronunciation")}</div>
                      <div className="text-lg font-semibold text-white">{Math.round(result.pronunciationScore)}%</div>
                    </div>
                  </div>

                  {result.wordResults.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {result.wordResults.map((word: any, idx: number) => (
                        <span
                          key={idx}
                          className={`px-3 py-1.5 rounded-lg text-sm font-arabic ${
                            word.match
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                          dir="rtl"
                        >
                          {word.word}
                          {word.tashkeelAccuracy !== undefined && (
                            <span className="ml-1.5 text-xs opacity-70" title="Tashkeel accuracy">
                              ح{word.tashkeelAccuracy}%
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {result.feedback.length > 0 && (
                    <div className={`rounded-lg p-4 ${
                      result.accuracy === 0
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-gray-800/50'
                    }`}>
                      <h4 className="text-sm font-medium text-gray-300 mb-2">{t("speech.results.feedback")}</h4>
                      <ul className="space-y-1.5">
                        {result.feedback.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              result.accuracy === 0 ? 'bg-amber-500' : 'bg-amber-500'
                            }`} />
                            {item.startsWith('http') ? (
                              <a href={item} target="_blank" rel="noopener noreferrer"
                                 className="text-amber-400 hover:text-amber-300 underline">
                                {item}
                              </a>
                            ) : (
                              item
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function SpeechPracticePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <SpeechPracticeContent />
    </Suspense>
  );
}
