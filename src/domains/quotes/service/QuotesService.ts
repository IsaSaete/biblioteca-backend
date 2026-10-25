import { Types, type QueryFilter } from "mongoose";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import ValidationError from "../../../shared/errors/ValidationError.js";
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
import validateUpdateQuoteDto from "../validator/validateUpdateQuoteDto.js";
import validateListQuotesQuery from "../validator/validateListQuotesQuery.js";
import type { QuoteBooksDto, QuoteDto, QuotesPageDto } from "../types/types.js";

export const QUOTES_PAGE_SIZE = 24;

const BOOK_NOT_FOUND = new NotFoundError(
  "BOOK_NOT_FOUND",
  "El libro no está en tu biblioteca",
);

const QUOTE_NOT_FOUND = new NotFoundError(
  "QUOTE_NOT_FOUND",
  "La cita no existe",
);

const createQuote = async (
  userId: string,
  body: unknown,
): Promise<QuoteDto> => {
  const dto = validateCreateQuoteDto(body);

  if (!dto.ejemplarId) {
    const quote = await Quote.create({
      userId,
      text: dto.text,
      origin: dto.origin,
      ...(dto.page !== undefined && { page: dto.page }),
      ...(dto.source && { source: dto.source }),
    });

    return mapQuoteToDto(quote.toObject());
  }

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
  const {
    bookId,
    unlinked,
    sort,
    cursor: rawCursor,
  } = validateListQuotesQuery(query);
  const cursor = rawCursor ? decodeLibraryCursor(rawCursor, sort) : undefined;
  // `recent` avanza hacia fechas anteriores; `oldest`, hacia fechas posteriores.
  const direction = sort === "recent" ? -1 : 1;
  const after = sort === "recent" ? "$lt" : "$gt";

  const filter: QueryFilter<QuoteDocument> = { userId };

  if (unlinked) {
    filter.ejemplarId = { $exists: false };
  }

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
          { createdAt: { [after]: new Date(cursor.value) } },
          {
            createdAt: new Date(cursor.value),
            _id: { [after]: new Types.ObjectId(cursor.id) },
          },
        ],
      }
    : filter;

  const rows = await Quote.find(pageFilter)
    .sort({ createdAt: direction, _id: direction })
    .limit(QUOTES_PAGE_SIZE + 1)
    .lean();

  const pageRows = rows.slice(0, QUOTES_PAGE_SIZE);
  const lastRow = pageRows.at(-1);
  const hasMore = rows.length > QUOTES_PAGE_SIZE;

  const ejemplares = await Ejemplar.find({
    _id: { $in: pageRows.flatMap((row) => row.ejemplarId ?? []) },
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
    if (!row.ejemplarId) {
      return [mapQuoteToDto(row)];
    }

    const ejemplar = ejemplarsById.get(row.ejemplarId.toString());
    const book = ejemplar && booksById.get(ejemplar.bookId.toString());

    return ejemplar && book ? [mapQuoteToDto(row, ejemplar, book)] : [];
  });

  return {
    items,
    nextCursor:
      hasMore && lastRow
        ? encodeLibraryCursor({
            sort,
            id: lastRow._id.toString(),
            value: lastRow.createdAt.toISOString(),
          })
        : null,
    total,
  };
};

// Un id mal formado o de otra persona es lo mismo para el cliente: esa cita no
// existe.
const findOwnQuote = async (userId: string, quoteId: string) => {
  if (!Types.ObjectId.isValid(quoteId)) {
    throw QUOTE_NOT_FOUND;
  }

  const quote = await Quote.findOne({ _id: quoteId, userId }).lean();

  if (!quote) {
    throw QUOTE_NOT_FOUND;
  }

  // Una cita sin libro no tiene ejemplar ni libro que cargar.
  if (!quote.ejemplarId) {
    return { quote, ejemplar: undefined, book: undefined };
  }

  const ejemplar = await Ejemplar.findById(quote.ejemplarId).lean();
  const book = ejemplar ? await Book.findById(ejemplar.bookId).lean() : null;

  if (!ejemplar || !book) {
    throw QUOTE_NOT_FOUND;
  }

  return { quote, ejemplar, book };
};

const getQuote = async (userId: string, quoteId: string): Promise<QuoteDto> => {
  const { quote, ejemplar, book } = await findOwnQuote(userId, quoteId);

  return mapQuoteToDto(quote, ejemplar, book);
};

const updateQuote = async (
  userId: string,
  quoteId: string,
  body: unknown,
): Promise<QuoteDto> => {
  const dto = validateUpdateQuoteDto(body);
  const current = await findOwnQuote(userId, quoteId);

  if (dto.source !== undefined && current.ejemplar) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "Solo las citas sin libro llevan fuente",
      "source",
    );
  }

  const $set = {
    ...(dto.text !== undefined && { text: dto.text }),
    ...(typeof dto.page === "number" && { page: dto.page }),
    ...(typeof dto.source === "string" && { source: dto.source }),
  };
  const $unset = {
    ...(dto.page === null && { page: 1 as const }),
    ...(dto.source === null && { source: 1 as const }),
  };

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return mapQuoteToDto(current.quote, current.ejemplar, current.book);
  }

  const updated = await Quote.findOneAndUpdate(
    { _id: quoteId, userId },
    {
      ...(Object.keys($set).length > 0 && { $set }),
      ...(Object.keys($unset).length > 0 && { $unset }),
    },
    { returnDocument: "after", runValidators: true },
  ).lean();

  if (!updated) {
    throw QUOTE_NOT_FOUND;
  }

  return mapQuoteToDto(updated, current.ejemplar, current.book);
};

const deleteQuote = async (userId: string, quoteId: string): Promise<void> => {
  if (!Types.ObjectId.isValid(quoteId)) {
    throw QUOTE_NOT_FOUND;
  }

  const deleted = await Quote.findOneAndDelete({ _id: quoteId, userId }).lean();

  if (!deleted) {
    throw QUOTE_NOT_FOUND;
  }
};

// Libros con al menos una cita y número de citas sin libro, para el filtro de
// la pantalla Citas. El título lleva los overrides del usuario.
const listQuoteBooks = async (userId: string): Promise<QuoteBooksDto> => {
  const unlinkedCount = await Quote.countDocuments({
    userId,
    ejemplarId: { $exists: false },
  });

  const counts = await Quote.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        ejemplarId: { $exists: true },
      },
    },
    { $group: { _id: "$ejemplarId", count: { $sum: 1 } } },
  ]);

  const ejemplares = await Ejemplar.find({
    _id: { $in: counts.map((row) => row._id) },
  }).lean();
  const books = await Book.find({
    _id: { $in: ejemplares.map((ejemplar) => ejemplar.bookId) },
  }).lean();

  const countsByEjemplar = new Map(
    counts.map((row) => [row._id.toString(), row.count]),
  );
  const booksById = new Map(books.map((book) => [book._id.toString(), book]));

  const items = ejemplares.flatMap((ejemplar) => {
    const book = booksById.get(ejemplar.bookId.toString());

    return book
      ? [
          {
            bookId: book._id.toString(),
            title: ejemplar.overrides?.title ?? book.title,
            count: countsByEjemplar.get(ejemplar._id.toString()) ?? 0,
          },
        ]
      : [];
  });

  const collator = new Intl.Collator("es", { sensitivity: "base" });

  return {
    items: items.sort((a, b) => collator.compare(a.title, b.title)),
    unlinkedCount,
  };
};

const QuotesService = {
  createQuote,
  listQuotes,
  getQuote,
  updateQuote,
  deleteQuote,
  listQuoteBooks,
};

export default QuotesService;
