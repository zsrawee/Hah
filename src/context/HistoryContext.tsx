"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Hadith } from "@/types/hadith";

interface HistoryContextType {
  history: Hadith[];
  addHadith: (hadith: Hadith) => void;
  isHadithRead: (collectionId?: number, hadithNumber?: number[]) => boolean;
  markAsRead: (collectionId?: number, hadithNumber?: number[]) => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<Hadith[]>([]);

  const addHadith = useCallback((hadith: Hadith) => {
    setHistory((prev) => {
      const key = `${hadith.collectionId}-${hadith.hadithNumber?.join(",")}`;
      const exists = prev.some(
        (h) => `${h.collectionId}-${h.hadithNumber?.join(",")}` === key
      );
      if (exists) return prev;
      return [hadith, ...prev].slice(0, 100);
    });
  }, []);

  const isHadithRead = useCallback(
    (collectionId?: number, hadithNumber?: number[]) => {
      return history.some(
        (h) =>
          h.collectionId === collectionId &&
          JSON.stringify(h.hadithNumber) === JSON.stringify(hadithNumber)
      );
    },
    [history]
  );

  const markAsRead = useCallback((collectionId?: number, hadithNumber?: number[]) => {
    setHistory((prev) => {
      const key = `${collectionId}-${hadithNumber?.join(",")}`;
      const exists = prev.some(
        (h) => `${h.collectionId}-${h.hadithNumber?.join(",")}` === key
      );
      if (exists) return prev;
      return prev;
    });
  }, []);

  return (
    <HistoryContext.Provider value={{ history, addHadith, isHadithRead, markAsRead }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}
