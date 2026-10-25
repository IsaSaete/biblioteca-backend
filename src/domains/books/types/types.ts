export const READING_STATUSES = [
  "pending",
  "reading",
  "read",
  "abandoned",
] as const;

export const FORMATS = ["hardcover", "paperback", "pocket"] as const;

export const PROVENANCES = ["bought", "gift", "borrowed", "inherited"] as const;

export const MAX_TAGS = 5;

export const COVER_SOURCES = ["google_books", "open_library"] as const;

export type ReadingStatus = (typeof READING_STATUSES)[number];
export type Format = (typeof FORMATS)[number];
export type Provenance = (typeof PROVENANCES)[number];
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

// Datos personales del Ejemplar que se editan con PATCH. `null` borra el
// campo; en `overrides`, `null` borra esa corrección concreta.
export interface UpdateEjemplarDto {
  status?: ReadingStatus;
  location?: string | null;
  format?: Format | null;
  provenance?: Provenance | null;
  acquisitionDate?: string | null;
  notes?: string | null;
  tags?: string[];
  favorite?: boolean;
  overrides?: {
    [K in keyof BookEditableFields]?: BookEditableFields[K] | null;
  };
}

export interface EjemplarDto {
  id: string;
  bookId: string;
  status: ReadingStatus;
  favorite: boolean;
  location?: string;
  format?: Format;
  provenance?: Provenance;
  acquisitionDate?: string;
  notes?: string;
  tags?: string[];
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
  total: number;
}

export type LibrarySort = "recent" | "alpha";

export interface ListLibraryQuery {
  search?: string;
  tag?: string;
  untagged: boolean;
  favorite: boolean;
  sort: LibrarySort;
  cursor?: string;
}

// Libro tal y como lo devuelve un proveedor externo: aún no está guardado, así
// que no tiene `id`. Los campos que el proveedor no da se omiten.
export interface ExternalBookDto {
  isbn?: string;
  title: string;
  authors: string[];
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
  language?: string;
  coverUrl?: string;
  coverSource?: CoverSource;
  synopsis?: string;
  categories?: string[];
}
