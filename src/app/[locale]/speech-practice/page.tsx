"use client";

import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter as useNextRouter } from "@/lib/navigation";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import SalawatButton from "@/components/SalawatButton";
import SpeechRecorder from "@/components/SpeechRecorder";
import { SpeechResult, analyzeArabicSpeech } from "@/lib/speechAnalysis";

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
      const res = await fetch(`/api/hadith/urn/${urn}`);
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

  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!hadith) return;
    setIsRecording(true);
    const arabicText = hadith.arabic?.content || hadith.arabic?.text || "";
    try {
      setResult(await analyzeArabicSpeech(audioBlob, arabicText.replace(/:\s*/, " ").trim()));
    } catch {
      setError("Failed to analyze recording");
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

  const arabicText = hadith?.arabic?.content || hadith?.arabic?.text || "";

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
                {arabicText && (
                  <p dir="rtl" className="text-xl md:text-2xl font-arabic leading-[2] text-white text-center">
                    {arabicText}
                  </p>
                )}
                {hadith.english && (
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    {hadith.english?.text || hadith.english?.content || ""}
                  </p>
                )}
              </div>

              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6">
                <h3 className="text-sm text-gray-400 text-center mb-4">{t("speech.recordingHint")}</h3>
                <SpeechRecorder
                  targetArabicText={arabicText}
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
                        {word.similarity !== undefined && (
                          <span className="ml-1.5 text-xs opacity-70">
                            {Math.round(word.similarity * 100)}%
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  {result.feedback.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">{t("speech.results.feedback")}</h4>
                      <ul className="space-y-1.5">
                        {result.feedback.map((item: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-400 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                            {item}
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
