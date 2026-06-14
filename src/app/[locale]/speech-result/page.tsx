"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import Navbar from "@/components/Navbar";

export default function SpeechResultPage() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <>
      <Navbar />
      <main className="relative z-10 min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-full mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{t("speech.result.title")}</h1>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">{t("speech.result.subtitle")}</p>
          <button
            onClick={() => router.push("/speech-practice")}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors"
          >
            {t("speech.result.tryAgain")}
          </button>
        </div>
      </main>
    </>
  );
}
