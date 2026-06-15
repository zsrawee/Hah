"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
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

  // Track the latest query so filter-change effect can re-search
  const currentQueryRef = useRef(initialQuery);

  const collections = [
    { id: "sahih-bukhari", name: "Sahih al-Bukhari" },
    { id: "sahih-muslim", name: "Sahih Muslim" },
    { id: "sunan-abu-dawud", name: "Sunan Abu Dawud" },
    { id: "sunan-ibn-majah", name: "Sunan Ibn Majah" },
    { id: "jami-at-tirmidhi", name: "Jami at-Tirmidhi" },
    { id: "sunan-an-nasai", name: "Sunan an-Nasa'i" },
  ];

  // The search function rebuilds when filterCollection changes
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
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filterCollection]);

  // When URL param changes (initial load, browser back/forward, form submit via router.push)
  useEffect(() => {
    if (initialQuery) {
      currentQueryRef.current = initialQuery;
      setQuery(initialQuery);
      search(initialQuery);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // When filter collection changes, re-run search with the current query
  useEffect(() => {
    if (currentQueryRef.current && hasSearched) {
      search(currentQueryRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCollection]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.trim();
    // Update URL so the query is shareable / persisted
    router.push(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
    // Also search immediately so the page doesn't wait for router
    currentQueryRef.current = q;
    search(q);
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
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t("search.button")}
                  </span>
                ) : (
                  t("search.button")
                )}
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => setFilterCollection("")}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  !filterCollection
                    ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30"
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
                      ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {col.name}
                </button>
              ))}
            </div>

            {/* Active filter indicator */}
            {filterCollection && hasSearched && (
              <p className="text-xs text-amber-500/70 mt-2">
                {t("search.filters.collection")}: {collections.find(c => c.id === filterCollection)?.name || filterCollection}
              </p>
            )}
          </form>

          {/* Results */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-800 rounded w-1/3 mb-3" />
                  <div className="h-16 bg-gray-800/70 rounded mb-2" />
                  <div className="h-3 bg-gray-800/50 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-30">⚠</div>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => search(currentQueryRef.current || query)}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t("search.tryAgain")}
              </button>
            </div>
          ) : hasSearched && results.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 opacity-30">🔍</div>
              <p className="text-gray-500">{t("search.noResults.title")}</p>
              <p className="text-gray-600 text-sm mt-2">{t("search.noResults.desc")}</p>
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {t("search.resultsCount", { count: results.length })}
                </p>
                <button
                  type="button"
                  onClick={() => setResults([])}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {t("search.button")} {t("search.allCollections").toLowerCase()}
                </button>
              </div>
              <div className="space-y-3">
                {results.map((hadith, index) => (
                  <HadithCard
                    key={`${hadith.collectionId}-${hadith.urn || hadith.hadithNumber || index}`}
                    hadith={hadith}
                    detailed={selectedHadith === hadith}
                    onClick={() => setSelectedHadith(selectedHadith === hadith ? null : hadith)}
                  />
                ))}
              </div>
            </div>
          ) : !hasSearched ? (
            /* Welcome state – prompt user to start searching */
            <div className="text-center py-20">
              <div className="text-6xl mb-6 opacity-20">📖</div>
              <h2 className="text-2xl font-semibold text-white mb-3">{t("search.welcome.title")}</h2>
              <p className="text-gray-500 max-w-md mx-auto">{t("search.welcome.desc")}</p>
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
