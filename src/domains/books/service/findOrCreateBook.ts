import Book from "../model/Book.js";
import type { BookRecord } from "../mapper/mapBookToDto.js";
import isDuplicateKeyError from "../utils/isDuplicateKeyError.js";
import type { CreateBookDto } from "../types/types.js";

// Busca el Libro compartido por ISBN y, si no existe, lo crea. Nunca modifica uno
// existente. Lo usan el alta en la biblioteca y la lista de deseos.
const findOrCreateBook = async (
  dto: CreateBookDto,
): Promise<{ book: BookRecord; isNew: boolean }> => {
  if (dto.isbn) {
    const existingBook = await Book.findOne({ isbn: dto.isbn }).lean();

    if (existingBook) {
      return { book: existingBook, isNew: false };
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
        return { book: concurrentBook, isNew: false };
      }
    }

    throw error;
  }
};

export default findOrCreateBook;
