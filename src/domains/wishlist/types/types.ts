import type {
  BookDto,
  CreateBookDto,
  ReadingStatus,
} from "../../books/types/types.js";

export const MAX_NOTE_LENGTH = 500;

// Los mismos datos que el alta de un libro (sin estado de lectura, que un
// deseado no tiene) más la nota opcional.
export interface AddToWishlistDto {
  book: CreateBookDto;
  note?: string;
}

// `note: null` (o vacía) borra la nota; sin `note`, no cambia nada.
export interface UpdateWishlistItemDto {
  note?: string | null;
}

// Estado de lectura con el que entra el libro en la biblioteca.
export interface AcquireWishlistItemDto {
  status: ReadingStatus;
}

export interface WishlistItemDto {
  id: string;
  book: BookDto;
  note?: string;
  createdAt: string;
}

export interface WishlistPageDto {
  items: WishlistItemDto[];
  nextCursor: string | null;
  total: number;
}
