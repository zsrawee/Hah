"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import SalawatButton from "@/components/SalawatButton";
import HadithCard from "@/components/HadithCard";

function SearchContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Hadith[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCollection, setFilterCollection] = useState("");
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  const collections = [
    { id: "sahih-bukhari", name: "Sahih al-Bukhari" },
    { id: "sahih-muslim", name: "Sahih Muslim" },
    { id: "sunan-abu-dawud", name: "Sunan Abu Dawud" },
    { id: "sunan-ibn-majah", name: "Sunan Ibn Majah" },
    { id: "jami-at-tirmidhi", name: "Jami at-Tirmidhi" },
    { id: "sunan-an-nasai", name: "Sunan an-Nasa'i" },
  ];

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedHadith(null);
    try {
      let url = `/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`;
      if (filterCollection) url += `&collection=${filterCollection}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || data);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filterCollection]);

  useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, [initialQuery, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <Navbar />
      <SalawatButton />
      <main className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <h1 className="text-3xl font-bold text-white mb-2">{t("search.title")}</h1>
          <p className="text-gray-400 mb-8">{t("search.subtitle")}</p>

          {/* Search form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search.placeholder")}
                dir="auto"
                className="flex-1 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl disabled:opacity-30 transition-colors"
              >
                {t("search.button")}
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => setFilterCollection("")}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  !filterCollection
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {t("search.allCollections")}
              </button>
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setFilterCollection(col.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    filterCollection === col.id
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </form>

          {/* Results */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => search(query)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t("search.tryAgain")}
              </button>
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">{t("search.noResults")}</p>
            </div>
          ) : results.length > 0 ? (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {t("search.resultsCount", { count: results.length })}
              </p>
              <div className="space-y-3">
                {results.map((hadith, index) => (
                  <HadithCard
                    key={`${hadith.collectionId}-${hadith.hadithNumber}-${index}`}
                    hadith={hadith}
                    detailed={selectedHadith === hadith}
                    onClick={() => setSelectedHadith(selectedHadith === hadith ? null : hadith)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <SearchContent />
    </Suspense>
  );
}
