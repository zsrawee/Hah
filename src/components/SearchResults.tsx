"use client";

import { Hadith } from "@/types/hadith";
import HadithCard from "./HadithCard";

interface SearchResultsProps {
  results: Hadith[];
  loading?: boolean;
}

export default function SearchResults({ results, loading = false }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {results.map((hadith, index) => (
        <HadithCard
          key={`${hadith.collectionId}-${hadith.hadithNumber}-${index}`}
          hadith={hadith}
        />
      ))}
    </div>
  );
}
