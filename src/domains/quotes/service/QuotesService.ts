import { Types, type QueryFilter } from "mongoose";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import Book from "../../books/model/Book.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import type { BookRecord } from "../../books/mapper/mapBookToDto.js";
import type { EjemplarRecord } from "../../books/mapper/mapEjemplarToDto.js";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
} from "../../books/utils/libraryCursor.js";
import Quote, { type QuoteDocument } from "../model/Quote.js";
import mapQuoteToDto from "../mapper/mapQuoteToDto.js";
import validateCreateQuoteDto from "../validator/validateCreateQuoteDto.js";
import validateListQuotesQuery from "../validator/validateListQuotesQuery.js";
import type { QuoteDto, QuotesPageDto } from "../types/types.js";

export const QUOTES_PAGE_SIZE = 24;

const BOOK_NOT_FOUND = new NotFoundError(
  "BOOK_NOT_FOUND",
  "El libro no está en tu biblioteca",
);

const createQuote = async (
  userId: string,
  body: unknown,
): Promise<QuoteDto> => {
  const dto = validateCreateQuoteDto(body);

  // Un id mal formado o de otro usuario es lo mismo para el cliente: ese libro
  // no está en su biblioteca.
  if (!Types.ObjectId.isValid(dto.ejemplarId)) {
    throw BOOK_NOT_FOUND;
  }

  const ejemplar = await Ejemplar.findOne({
    _id: dto.ejemplarId,
    userId,
  }).lean();
  const book = ejemplar ? await Book.findById(ejemplar.bookId).lean() : null;

  if (!ejemplar || !book) {
    throw BOOK_NOT_FOUND;
  }

  const quote = await Quote.create({
    userId,
    ejemplarId: ejemplar._id,
    text: dto.text,
    origin: dto.origin,
    ...(dto.page !== undefined && { page: dto.page }),
  });

  return mapQuoteToDto(quote.toObject(), ejemplar, book);
};

const listQuotes = async (
  userId: string,
  query: unknown,
): Promise<QuotesPageDto> => {
  const { bookId, cursor: rawCursor } = validateListQuotesQuery(query);
  const cursor = rawCursor
    ? decodeLibraryCursor(rawCursor, "recent")
    : undefined;

  const filter: QueryFilter<QuoteDocument> = { userId };

  if (bookId) {
    if (!Types.ObjectId.isValid(bookId)) {
      throw BOOK_NOT_FOUND;
    }

    const ejemplar = await Ejemplar.findOne({ userId, bookId }).lean();

    if (!ejemplar) {
      throw BOOK_NOT_FOUND;
    }

    filter.ejemplarId = ejemplar._id;
  }

  const total = await Quote.countDocuments(filter);

  const pageFilter: QueryFilter<QuoteDocument> = cursor
    ? {
        ...filter,
        $or: [
          { createdAt: { $lt: new Date(cursor.value) } },
          {
            createdAt: new Date(cursor.value),
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ],
      }
    : filter;

  const rows = await Quote.find(pageFilter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(QUOTES_PAGE_SIZE + 1)
    .lean();

  const pageRows = rows.slice(0, QUOTES_PAGE_SIZE);
  const lastRow = pageRows.at(-1);
  const hasMore = rows.length > QUOTES_PAGE_SIZE;

  const ejemplares = await Ejemplar.find({
    _id: { $in: pageRows.map((row) => row.ejemplarId) },
  }).lean();
  const books = await Book.find({
    _id: { $in: ejemplares.map((ejemplar) => ejemplar.bookId) },
  }).lean();

  const ejemplarsById = new Map<string, EjemplarRecord>(
    ejemplares.map((ejemplar) => [ejemplar._id.toString(), ejemplar]),
  );
  const booksById = new Map<string, BookRecord>(
    books.map((book) => [book._id.toString(), book]),
  );

  const items = pageRows.flatMap((row) => {
    const ejemplar = ejemplarsById.get(row.ejemplarId.toString());
    const book = ejemplar && booksById.get(ejemplar.bookId.toString());

    return ejemplar && book ? [mapQuoteToDto(row, ejemplar, book)] : [];
  });

  return {
    items,
    nextCursor:
      hasMore && lastRow
        ? encodeLibraryCursor({
            sort: "recent",
            id: lastRow._id.toString(),
            value: lastRow.createdAt.toISOString(),
          })
        : null,
    total,
  };
};

const QuotesService = { createQuote, listQuotes };

export default QuotesService;
