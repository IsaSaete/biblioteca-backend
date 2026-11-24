import Book from "../model/Book.js";
import type { BookRecord } from "../mapper/mapBookToDto.js";
import isDuplicateKeyError from "../utils/isDuplicateKeyError.js";
import type { CreateBookDto } from "../types/types.js";

// Un Libro creado sin portada (porque el catálogo no la tenía) la recibe de
// quien la trae después: es un dato del catálogo, igual para todos, y solo se
// rellena un hueco; una portada existente nunca se cambia.
const fillMissingCover = async (
  book: BookRecord,
  dto: CreateBookDto,
): Promise<BookRecord> => {
  if (book.coverUrl || !dto.coverUrl || !dto.coverSource) {
    return book;
  }

  const updatedBook = await Book.findOneAndUpdate(
    { _id: book._id, coverUrl: null },
    { $set: { coverUrl: dto.coverUrl, coverSource: dto.coverSource } },
    { new: true },
  ).lean();

  return updatedBook ?? book;
};

// Busca el Libro compartido por ISBN y, si no existe, lo crea. No modifica uno
// existente, salvo para rellenarle la portada si no tenía. Lo usan el alta en
// la biblioteca y la lista de deseos.
const findOrCreateBook = async (
  dto: CreateBookDto,
): Promise<{ book: BookRecord; isNew: boolean }> => {
  if (dto.isbn) {
    const existingBook = await Book.findOne({ isbn: dto.isbn }).lean();

    if (existingBook) {
      return { book: await fillMissingCover(existingBook, dto), isNew: false };
    }
  }

  try {
    const { status: _status, ...bookFields } = dto;
    const createdBook = await Book.create(bookFields);

    return { book: createdBook.toObject(), isNew: true };
  } catch (error) {
    // Otra petición creó el mismo ISBN entre la comprobación y el alta.
    if (dto.isbn && isDuplicateKeyError(error)) {
      const concurrentBook = await Book.findOne({ isbn: dto.isbn }).lean();

      if (concurrentBook) {
        return {
          book: await fillMissingCover(concurrentBook, dto),
          isNew: false,
        };
      }
    }

    throw error;
  }
};

export default findOrCreateBook;
