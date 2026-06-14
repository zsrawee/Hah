"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Hadith } from "@/types/hadith";
import Navbar from "@/components/Navbar";
import SalawatButton from "@/components/SalawatButton";
import HadithCard from "@/components/HadithCard";

export default function RandomPage() {
  const t = useTranslations();
  const [hadith, setHadith] = useState<Hadith | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRandom();
  }, []);

  const fetchRandom = () => {
    setLoading(true);
    fetch("/api/random")
      .then((r) => r.json())
      .then(setHadith)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Navbar />
      <SalawatButton />
      <main className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-white mb-2">{t("random.title")}</h1>
          <p className="text-gray-400 mb-8">{t("random.subtitle")}</p>

          {loading ? (
            <div className="skeleton h-48" />
          ) : hadith ? (
            <div className="space-y-6 animate-fade-in">
              <HadithCard hadith={hadith} detailed />
              <div className="flex justify-center">
                <button
                  onClick={fetchRandom}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors"
                >
                  {t("random.another")}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">{t("random.error")}</p>
              <button
                onClick={fetchRandom}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                {t("random.tryAgain")}
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
