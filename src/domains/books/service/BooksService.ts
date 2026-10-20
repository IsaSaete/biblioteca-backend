import { Types, type PipelineStage } from "mongoose";
import ConflictError from "../../../shared/errors/ConflictError.js";
import Book from "../model/Book.js";
import Ejemplar from "../model/Ejemplar.js";
import mapBookToDto, { type BookRecord } from "../mapper/mapBookToDto.js";
import mapEjemplarToDto, {
  type EjemplarRecord,
} from "../mapper/mapEjemplarToDto.js";
import validateCreateBookDto from "../validator/validateCreateBookDto.js";
import validateListLibraryQuery from "../validator/validateListLibraryQuery.js";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
} from "../utils/libraryCursor.js";
import type {
  BookEditableFields,
  CreateBookDto,
  LibraryItemDto,
  LibraryPageDto,
} from "../types/types.js";

export const LIBRARY_PAGE_SIZE = 24;

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const BOOK_ALREADY_IN_LIBRARY = new ConflictError(
  "BOOK_ALREADY_IN_LIBRARY",
  "Este libro ya está en tu biblioteca",
);

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === MONGO_DUPLICATE_KEY_ERROR;

const isSameValue = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

// Lo que el usuario ha cambiado respecto al Libro compartido en «Confirma los
// datos». Un campo que no envía no cuenta como corrección.
const buildOverrides = (
  book: BookRecord,
  dto: CreateBookDto,
): Partial<BookEditableFields> | undefined => {
  const overrides: Partial<BookEditableFields> = {};
  const editableKeys = [
    "title",
    "authors",
    "publisher",
    "publishedYear",
    "pageCount",
    "language",
    "synopsis",
    "categories",
  ] as const satisfies readonly (keyof BookEditableFields)[];

  for (const key of editableKeys) {
    if (dto[key] !== undefined && !isSameValue(dto[key], book[key])) {
      Object.assign(overrides, { [key]: dto[key] });
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

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

const createBook = async (
  userId: string,
  body: unknown,
): Promise<LibraryItemDto> => {
  const dto = validateCreateBookDto(body);
  const { book, isNew } = await findOrCreateBook(dto);

  if (!isNew) {
    const alreadyOwned = await Ejemplar.exists({ userId, bookId: book._id });

    if (alreadyOwned) {
      throw BOOK_ALREADY_IN_LIBRARY;
    }
  }

  try {
    const overrides = isNew ? undefined : buildOverrides(book, dto);
    const ejemplar = await Ejemplar.create({
      userId,
      bookId: book._id,
      status: dto.status,
      ...(overrides && { overrides }),
    });

    return {
      book: mapBookToDto(book),
      ejemplar: mapEjemplarToDto(ejemplar.toObject()),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw BOOK_ALREADY_IN_LIBRARY;
    }

    throw error;
  }
};

interface LibraryRow extends EjemplarRecord {
  book: BookRecord;
}

const buildLibraryPipeline = (
  userId: string,
  sort: "recent" | "alpha",
  cursor: ReturnType<typeof decodeLibraryCursor> | undefined,
): PipelineStage[] => {
  const cursorId = cursor ? new Types.ObjectId(cursor.id) : undefined;
  const pipeline: PipelineStage[] = [
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: Book.collection.name,
        localField: "bookId",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: "$book" },
  ];

  if (sort === "recent") {
    if (cursor && cursorId) {
      const createdAt = new Date(cursor.value);

      pipeline.push({
        $match: {
          $or: [
            { createdAt: { $lt: createdAt } },
            { createdAt, _id: { $lt: cursorId } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
  } else {
    if (cursor && cursorId) {
      pipeline.push({
        $match: {
          $or: [
            { "book.title": { $gt: cursor.value } },
            { "book.title": cursor.value, _id: { $gt: cursorId } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { "book.title": 1, _id: 1 } });
  }

  pipeline.push({ $limit: LIBRARY_PAGE_SIZE + 1 });

  return pipeline;
};

const listLibrary = async (
  userId: string,
  query: unknown,
): Promise<LibraryPageDto> => {
  const { sort, cursor: rawCursor } = validateListLibraryQuery(query);
  const cursor = rawCursor ? decodeLibraryCursor(rawCursor, sort) : undefined;

  // La ordenación alfabética ignora mayúsculas y acentos (collation español).
  const rows = await Ejemplar.aggregate<LibraryRow>(
    buildLibraryPipeline(userId, sort, cursor),
  ).collation({ locale: "es", strength: 1 });

  const pageRows = rows.slice(0, LIBRARY_PAGE_SIZE);
  const lastRow = pageRows.at(-1);
  const hasMore = rows.length > LIBRARY_PAGE_SIZE;

  return {
    items: pageRows.map((row) => ({
      book: mapBookToDto(row.book),
      ejemplar: mapEjemplarToDto(row),
    })),
    nextCursor:
      hasMore && lastRow
        ? encodeLibraryCursor({
            sort,
            id: lastRow._id.toString(),
            value:
              sort === "recent"
                ? lastRow.createdAt.toISOString()
                : lastRow.book.title,
          })
        : null,
  };
};

const BooksService = { createBook, listLibrary };

export default BooksService;
