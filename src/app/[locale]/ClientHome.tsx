"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import HadithCard from "@/components/HadithCard";
import SalawatButton from "@/components/SalawatButton";

interface Stats {
  collection_count: number;
  total_books: number;
  total_chapters: number;
}

export default function ClientHome() {
  const t = useTranslations();
  const router = useRouter();
  const [featured, setFeatured] = useState<Hadith | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    fetch("/api/random")
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(setFeatured)
      .catch((err) => console.error('Home error:', err));
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((data) => setStats(data.statistics || data))
      .catch((err) => console.error('Stats error:', err));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsNavigating(true);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleRandom = () => {
    setIsNavigating(true);
    router.push("/random");
  };

  return (
    <>
      <Navbar />
      <SalawatButton />
      <main className="relative z-10 min-h-screen pt-16">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight">
            {t("app.title")}
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            {t("home.description")}
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-amber-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center bg-gray-900 border border-gray-700/50 rounded-2xl overflow-hidden focus-within:border-amber-500/50 transition-colors">
                <svg
                  className="ml-5 w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("home.searchPlaceholder")}
                  dir="auto"
                  className="flex-1 py-4 px-4 bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isNavigating}
                  className="mr-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {t("home.searchButton")}
                </button>
              </div>
            </div>
          </form>

          {/* Quick actions */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={handleRandom}
              disabled={isNavigating}
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
              </svg>
              {t("home.randomButton")}
            </button>
          </div>
        </section>

        {/* Stats */}
        {stats && (
          <section className="border-y border-gray-800/50">
            <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.total_chapters.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{t("stats.hadiths")}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.collection_count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{t("stats.collections")}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">
                  {stats.total_books.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{t("browse.books")}</div>
              </div>
            </div>
          </section>
        )}

        {/* Featured hadith */}
        {featured && (
          <section className="max-w-4xl mx-auto px-4 py-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-white">
                {t("home.featured")}
              </h2>
              <div className="h-px flex-1 ml-6 bg-gray-800" />
            </div>
            <HadithCard hadith={featured} detailed />
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-gray-800/50 mt-8">
          <div className="max-w-4xl mx-auto px-4 py-10 text-center">
            <p className="text-gray-500 text-sm">
              {t("footer.description")}
            </p>
            <p className="text-gray-600 text-xs mt-3">
              {t("footer.hadithDisclaimer")}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
