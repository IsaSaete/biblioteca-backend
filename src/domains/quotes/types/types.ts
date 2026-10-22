export const QUOTE_ORIGINS = ["manual", "ocr"] as const;

export const MAX_QUOTE_LENGTH = 5000;

export const MAX_SOURCE_LENGTH = 120;

export type QuoteOrigin = (typeof QUOTE_ORIGINS)[number];

export interface CreateQuoteDto {
  ejemplarId?: string;
  text: string;
  page?: number;
  source?: string;
  origin: QuoteOrigin;
}

// `page: null` borra la página; `text` no admite `null`.
export interface UpdateQuoteDto {
  text?: string;
  page?: number | null;
}

export interface ListQuotesQuery {
  bookId?: string;
  cursor?: string;
}

// Una cita sin libro no lleva `ejemplarId` ni `book` (así se distingue) y puede
// llevar `source`; una cita con libro nunca lleva `source`.
export interface QuoteDto {
  id: string;
  ejemplarId?: string;
  text: string;
  page?: number;
  source?: string;
  createdAt: string;
  book?: {
    id: string;
    title: string;
    authors: string[];
  };
}

export interface QuotesPageDto {
  items: QuoteDto[];
  nextCursor: string | null;
  total: number;
}

export interface QuoteBooksDto {
  items: QuoteBookDto[];
  unlinkedCount: number;
}

export interface QuoteBookDto {
  bookId: string;
  title: string;
  count: number;
}
