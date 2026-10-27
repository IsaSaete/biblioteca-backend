import { Types, type QueryFilter } from "mongoose";
import ConflictError from "../../../shared/errors/ConflictError.js";
import Book from "../../books/model/Book.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import type { BookRecord } from "../../books/mapper/mapBookToDto.js";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
} from "../../books/utils/libraryCursor.js";
import findOrCreateBook from "../../books/service/findOrCreateBook.js";
import isDuplicateKeyError from "../../books/utils/isDuplicateKeyError.js";
import WishlistItem, {
  type WishlistItemDocument,
} from "../model/WishlistItem.js";
import mapWishlistItemToDto from "../mapper/mapWishlistItemToDto.js";
import validateListWishlistQuery from "../validator/validateListWishlistQuery.js";
import validateAddToWishlistDto from "../validator/validateAddToWishlistDto.js";
import type { WishlistItemDto, WishlistPageDto } from "../types/types.js";

export const WISHLIST_PAGE_SIZE = 24;

const BOOK_ALREADY_IN_LIBRARY = new ConflictError(
  "BOOK_ALREADY_IN_LIBRARY",
  "Este libro ya está en tu biblioteca",
);

const BOOK_ALREADY_IN_WISHLIST = new ConflictError(
  "BOOK_ALREADY_IN_WISHLIST",
  "Este libro ya está en tu lista de deseos",
);

// Si el Libro ya existe se enlaza tal cual: un deseado no tiene overrides, así
// que los datos que difieran se ignoran y las correcciones se hacen al pasarlo
// a la biblioteca.
const addToWishlist = async (
  userId: string,
  body: unknown,
): Promise<WishlistItemDto> => {
  const dto = validateAddToWishlistDto(body);
  const { book, isNew } = await findOrCreateBook(dto.book);

  if (!isNew && (await Ejemplar.exists({ userId, bookId: book._id }))) {
    throw BOOK_ALREADY_IN_LIBRARY;
  }

  try {
    const item = await WishlistItem.create({
      userId,
      bookId: book._id,
      ...(dto.note && { note: dto.note }),
    });

    return mapWishlistItemToDto(item.toObject(), book);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw BOOK_ALREADY_IN_WISHLIST;
    }

    throw error;
  }
};

// Más reciente primero. El cursor guarda la posición del último deseado
// entregado (fecha y id, para desempatar los guardados en el mismo instante).
const listWishlist = async (
  userId: string,
  query: unknown,
): Promise<WishlistPageDto> => {
  const { cursor: rawCursor } = validateListWishlistQuery(query);
  const cursor = rawCursor
    ? decodeLibraryCursor(rawCursor, "recent")
    : undefined;
  const owner = new Types.ObjectId(userId);

  const total = await WishlistItem.countDocuments({ userId: owner });

  const pageFilter: QueryFilter<WishlistItemDocument> = cursor
    ? {
        userId: owner,
        $or: [
          { createdAt: { $lt: new Date(cursor.value) } },
          {
            createdAt: new Date(cursor.value),
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ],
      }
    : { userId: owner };

  const rows = await WishlistItem.find(pageFilter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(WISHLIST_PAGE_SIZE + 1)
    .lean();

  const pageRows = rows.slice(0, WISHLIST_PAGE_SIZE);
  const lastRow = pageRows.at(-1);

  const books = await Book.find({
    _id: { $in: pageRows.map((row) => row.bookId) },
  }).lean();
  const booksById = new Map<string, BookRecord>(
    books.map((book) => [book._id.toString(), book]),
  );

  return {
    items: pageRows.flatMap((row) => {
      const book = booksById.get(row.bookId.toString());

      return book ? [mapWishlistItemToDto(row, book)] : [];
    }),
    nextCursor:
      rows.length > WISHLIST_PAGE_SIZE && lastRow
        ? encodeLibraryCursor({
            sort: "recent",
            id: lastRow._id.toString(),
            value: lastRow.createdAt.toISOString(),
          })
        : null,
    total,
  };
};

const WishlistService = { addToWishlist, listWishlist };

export default WishlistService;
