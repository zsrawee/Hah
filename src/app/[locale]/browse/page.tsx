"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import SalawatButton from "@/components/SalawatButton";
import HadithCard from "@/components/HadithCard";

interface Book {
  id: string;
  name: string;
  hadithCount: number;
}

export default function BrowsePage() {
  const t = useTranslations();
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [hadiths, setHadiths] = useState<Hadith[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHadiths, setLoadingHadiths] = useState(false);
  const [selectedHadith, setSelectedHadith] = useState<Hadith | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetch("/api/books")
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then(setBooks)
      .catch((err) => console.error('Books fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBook) {
      setHadiths([]);
      return;
    }
    setLoadingHadiths(true);
    fetch(`/api/hadiths?collection=${selectedBook}&page=${page}&limit=20`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch');
        return r.json();
      })
      .then((data) => {
        const newHadiths = data.hadiths || data.arabic || data;
        setHadiths((prev) => (page === 1 ? newHadiths : [...prev, ...newHadiths]));
        setHasMore(Array.isArray(newHadiths) && newHadiths.length === 20);
      })
      .catch((err) => console.error('Hadiths fetch error:', err))
      .finally(() => setLoadingHadiths(false));
  }, [selectedBook, page]);

  return (
    <>
      <Navbar />
      <SalawatButton />
      <main className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-white mb-2">{t("browse.title")}</h1>
          <p className="text-gray-400 mb-8">{t("browse.subtitle")}</p>

          {/* Book grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {books.map((book) => (
                <button
                  key={book.id}
                  onClick={() => { setSelectedBook(book.id); setPage(1); setSelectedHadith(null); }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedBook === book.id
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-800"
                  }`}
                >
                  <div className="text-sm font-medium mb-1 line-clamp-1">{book.name}</div>
                  <div className="text-xs text-gray-500">
                    {book.hadithCount.toLocaleString()} {t("browse.hadiths")}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Hadiths */}
          {selectedBook && (
            <div>
              {loadingHadiths && page === 1 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-32" />
                  ))}
                </div>
              ) : hadiths.length > 0 ? (
                <div className="space-y-3">
                  {hadiths.map((hadith, index) => (
                    <HadithCard
                      key={`${hadith.hadithNumber}-${index}`}
                      hadith={hadith}
                      detailed={selectedHadith === hadith}
                      onClick={() => setSelectedHadith(selectedHadith === hadith ? null : hadith)}
                    />
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={loadingHadiths}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm disabled:opacity-30 transition-colors"
                    >
                      {loadingHadiths ? t("browse.loading") : t("browse.loadMore")}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">{t("browse.noHadiths")}</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
