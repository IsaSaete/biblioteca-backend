export const READING_STATUSES = [
  "pending",
  "reading",
  "read",
  "abandoned",
] as const;

export const COVER_SOURCES = ["google_books", "open_library"] as const;

export type ReadingStatus = (typeof READING_STATUSES)[number];
export type CoverSource = (typeof COVER_SOURCES)[number];

// Campos de Libro que el usuario puede corregir; en Ejemplar.overrides se
// guarda solo lo que difiere del Libro.
export interface BookEditableFields {
  title: string;
  authors: string[];
  publisher: string;
  publishedYear: number;
  pageCount: number;
  language: string;
  synopsis: string;
  categories: string[];
}

export interface CreateBookDto {
  isbn?: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedYear?: number;
  pageCount?: number;
  language?: string;
  coverUrl?: string;
  coverSource?: CoverSource;
  synopsis?: string;
  categories?: string[];
  status: ReadingStatus;
}

export interface BookDto {
  id: string;
  isbn?: string;
  title: string;
  authors: string[];
  publisher: string;
  publishedYear?: number;
  pageCount?: number;
  language?: string;
  coverUrl?: string;
  coverSource?: CoverSource;
  synopsis?: string;
  categories?: string[];
}

export interface EjemplarDto {
  id: string;
  bookId: string;
  status: ReadingStatus;
  overrides?: Partial<BookEditableFields>;
  createdAt: string;
}

export interface LibraryItemDto {
  book: BookDto;
  ejemplar: EjemplarDto;
}

export interface LibraryPageDto {
  items: LibraryItemDto[];
  nextCursor: string | null;
}

export type LibrarySort = "recent" | "alpha";

export interface ListLibraryQuery {
  sort: LibrarySort;
  cursor?: string;
}
