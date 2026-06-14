export interface HadithArabic {
  urn?: string;
  collection_id?: number;
  book_id?: number;
  display_number?: string;
  order_in_book?: number;
  chapter_id?: number;
  narrator_prefix?: string;
  content?: string;
  narrator_postfix?: string;
  grades?: string;
  narrators?: string;
  comments?: string;
  // Alternative field names used by hadith npm package
  text?: string;
  textShamela?: string;
  c0?: string;
}

export interface HadithEnglish {
  arabic_urn?: string;
  urn?: string;
  collection_id?: number;
  narrator_prefix?: string;
  content?: string;
  narrator_postfix?: string;
  grades?: string;
  reference?: string;
  // Alternative field names
  text?: string;
}

export interface Hadith {
  id?: number;
  collection?: string;
  collectionId?: number;
  bookId?: number;
  bookName?: string;
  hadithNumber?: number[];
  urn?: string;
  narrator?: string;
  narratorArabic?: string;
  textShamela?: string;
  grades?: string;
  comments?: string;
  narrators?: string;
  arabic?: HadithArabic;
  english?: HadithEnglish;
  // For search results
  arabic_urn?: string;
  display_number?: string;
  content?: string;
  narrator_prefix?: string;
  narrator_postfix?: string;
}
