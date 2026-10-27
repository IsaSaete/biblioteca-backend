import type { BookDto, CreateBookDto } from "../../books/types/types.js";

export const MAX_NOTE_LENGTH = 500;

// Los mismos datos que el alta de un libro (sin estado de lectura, que un
// deseado no tiene) más la nota opcional.
export interface AddToWishlistDto {
  book: CreateBookDto;
  note?: string;
}

export interface WishlistItemDto {
  id: string;
  book: BookDto;
  note?: string;
  createdAt: string;
}
