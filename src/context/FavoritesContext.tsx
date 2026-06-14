"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Hadith } from "@/types/hadith";

interface FavoritesContextType {
  favorites: Hadith[];
  addHadith: (hadith: Hadith) => void;
  removeHadith: (collectionId?: number, hadithNumber?: number[]) => void;
  isHadithSaved: (collectionId?: number, hadithNumber?: number[]) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Hadith[]>([]);

  const addHadith = useCallback((hadith: Hadith) => {
    setFavorites((prev) => {
      const key = `${hadith.collectionId}-${hadith.hadithNumber?.join(",")}`;
      const exists = prev.some(
        (h) => `${h.collectionId}-${h.hadithNumber?.join(",")}` === key
      );
      if (exists) return prev;
      return [...prev, hadith];
    });
  }, []);

  const removeHadith = useCallback((collectionId?: number, hadithNumber?: number[]) => {
    setFavorites((prev) =>
      prev.filter(
        (h) =>
          !(
            h.collectionId === collectionId &&
            JSON.stringify(h.hadithNumber) === JSON.stringify(hadithNumber)
          )
      )
    );
  }, []);

  const isHadithSaved = useCallback(
    (collectionId?: number, hadithNumber?: number[]) => {
      return favorites.some(
        (h) =>
          h.collectionId === collectionId &&
          JSON.stringify(h.hadithNumber) === JSON.stringify(hadithNumber)
      );
    },
    [favorites]
  );

  return (
    <FavoritesContext.Provider
      value={{ favorites, addHadith, removeHadith, isHadithSaved }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
