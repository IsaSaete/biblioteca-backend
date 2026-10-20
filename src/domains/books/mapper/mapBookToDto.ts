import type { Types } from "mongoose";
import type { BookDocument } from "../model/Book.js";
import type { BookDto } from "../types/types.js";

export type BookRecord = BookDocument & { _id: Types.ObjectId };

const mapBookToDto = (book: BookRecord): BookDto => ({
  id: book._id.toString(),
  ...(book.isbn && { isbn: book.isbn }),
  title: book.title,
  authors: [...book.authors],
  publisher: book.publisher,
  ...(typeof book.publishedYear === "number" && {
    publishedYear: book.publishedYear,
  }),
  ...(typeof book.pageCount === "number" && { pageCount: book.pageCount }),
  ...(book.language && { language: book.language }),
  ...(book.coverUrl && { coverUrl: book.coverUrl }),
  ...(book.coverUrl && book.coverSource && { coverSource: book.coverSource }),
  ...(book.synopsis && { synopsis: book.synopsis }),
  ...(book.categories && { categories: [...book.categories] }),
});

export default mapBookToDto;
