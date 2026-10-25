import { Types, type PipelineStage, type QueryFilter } from "mongoose";
import ValidationError from "../../../shared/errors/ValidationError.js";
import Book from "../../books/model/Book.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import type { BookRecord } from "../../books/mapper/mapBookToDto.js";
import type { EjemplarRecord } from "../../books/mapper/mapEjemplarToDto.js";
import {
  encodeLibraryCursor,
  type LibraryCursor,
} from "../../books/utils/libraryCursor.js";
import Quote, { type QuoteDocument } from "../model/Quote.js";
import type { QuoteRecord } from "../mapper/mapQuoteToDto.js";

// Las citas sin libro van al final, agrupadas bajo un libro «vacío».
const NO_BOOK_RANK = 1;
const NO_BOOK_EJEMPLAR = new Types.ObjectId("000000000000000000000000");

export interface QuoteByBookRow extends QuoteRecord {
  ejemplar?: EjemplarRecord;
  book?: BookRecord;
  sortRank: number;
  sortTitle: string;
  sortEjemplar: Types.ObjectId;
}

// Posición dentro del orden por libro: libros por título (con las correcciones
// del usuario), citas de un mismo ejemplar juntas, y dentro de él por guardado.
interface BookOrderPosition {
  rank: number;
  title: string;
  ejemplarId: string;
  createdAt: string;
}

const invalidCursor = (): ValidationError =>
  new ValidationError("VALIDATION_ERROR", "El cursor no es válido", "cursor");

export type BookOrder = "book" | "book_desc";

export const encodeBookOrderCursor = (
  row: QuoteByBookRow,
  sort: BookOrder,
): string =>
  encodeLibraryCursor({
    sort,
    id: row._id.toString(),
    value: JSON.stringify([
      row.sortRank,
      row.sortTitle,
      row.sortEjemplar.toString(),
      row.createdAt.toISOString(),
    ] satisfies [number, string, string, string]),
  });

const parsePosition = (cursor: LibraryCursor): BookOrderPosition => {
  try {
    const parsed: unknown = JSON.parse(cursor.value);

    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      typeof parsed[0] === "number" &&
      typeof parsed[1] === "string" &&
      typeof parsed[2] === "string" &&
      Types.ObjectId.isValid(parsed[2]) &&
      typeof parsed[3] === "string" &&
      !Number.isNaN(Date.parse(parsed[3]))
    ) {
      return {
        rank: parsed[0],
        title: parsed[1],
        ejemplarId: parsed[2],
        createdAt: parsed[3],
      };
    }
  } catch {
    // Se trata igual que cualquier otro cursor manipulado o corrupto.
  }

  throw invalidCursor();
};

const buildAfterCursorStage = (
  cursor: LibraryCursor,
  titleAfter: "$gt" | "$lt",
): PipelineStage => {
  const { rank, title, ejemplarId, createdAt } = parsePosition(cursor);
  const sameBook = {
    sortRank: rank,
    sortTitle: title,
    sortEjemplar: new Types.ObjectId(ejemplarId),
  };
  const date = new Date(createdAt);

  return {
    $match: {
      $or: [
        { sortRank: { $gt: rank } },
        { sortRank: rank, sortTitle: { [titleAfter]: title } },
        {
          sortRank: rank,
          sortTitle: title,
          sortEjemplar: { $gt: sameBook.sortEjemplar },
        },
        { ...sameBook, createdAt: { $gt: date } },
        {
          ...sameBook,
          createdAt: date,
          _id: { $gt: new Types.ObjectId(cursor.id) },
        },
      ],
    },
  };
};

interface FindQuotesByBookOptions {
  cursor?: LibraryCursor;
  limit: number;
  sort: BookOrder;
}

// Una tanda (más una) de citas ordenadas por libro. El título se compara sin
// distinguir mayúsculas ni tildes (collation español). Con `book_desc` solo se
// invierte el orden de los libros: dentro de cada uno las citas siguen en orden
// de guardado y las citas sin libro siguen al final.
const findQuotesByBook = (
  userId: string,
  filter: QueryFilter<QuoteDocument>,
  { cursor, limit, sort }: FindQuotesByBookOptions,
): Promise<QuoteByBookRow[]> =>
  Quote.aggregate<QuoteByBookRow>([
    { $match: { ...filter, userId: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: Ejemplar.collection.name,
        localField: "ejemplarId",
        foreignField: "_id",
        as: "ejemplar",
      },
    },
    { $unwind: { path: "$ejemplar", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Book.collection.name,
        localField: "ejemplar.bookId",
        foreignField: "_id",
        as: "book",
      },
    },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        sortRank: {
          $cond: [{ $ifNull: ["$ejemplarId", false] }, 0, NO_BOOK_RANK],
        },
        sortTitle: {
          $ifNull: ["$ejemplar.overrides.title", "$book.title", ""],
        },
        sortEjemplar: { $ifNull: ["$ejemplarId", NO_BOOK_EJEMPLAR] },
      },
    },
    ...(cursor
      ? [buildAfterCursorStage(cursor, sort === "book" ? "$gt" : "$lt")]
      : []),
    {
      $sort: {
        sortRank: 1,
        sortTitle: sort === "book" ? 1 : -1,
        sortEjemplar: 1,
        createdAt: 1,
        _id: 1,
      },
    },
    { $limit: limit },
  ]).collation({ locale: "es", strength: 1 });

export default findQuotesByBook;
