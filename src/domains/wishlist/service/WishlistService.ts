import { Types, type QueryFilter } from "mongoose";
import ConflictError from "../../../shared/errors/ConflictError.js";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import Book from "../../books/model/Book.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import mapBookToDto from "../../books/mapper/mapBookToDto.js";
import mapEjemplarToDto from "../../books/mapper/mapEjemplarToDto.js";
import type { LibraryItemDto } from "../../books/types/types.js";
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
import validateAcquireWishlistItemDto from "../validator/validateAcquireWishlistItemDto.js";
import validateUpdateWishlistItemDto from "../validator/validateUpdateWishlistItemDto.js";
import validateListWishlistQuery from "../validator/validateListWishlistQuery.js";
import validateAddToWishlistDto from "../validator/validateAddToWishlistDto.js";
import type { WishlistItemDto, WishlistPageDto } from "../types/types.js";

export const WISHLIST_PAGE_SIZE = 24;

const BOOK_ALREADY_IN_LIBRARY = new ConflictError(
  "BOOK_ALREADY_IN_LIBRARY",
  "Este libro ya está en tu biblioteca",
);

const WISHLIST_ITEM_NOT_FOUND = new NotFoundError(
  "WISHLIST_ITEM_NOT_FOUND",
  "El libro no está en tu lista de deseos",
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

// Solo se puede editar la nota. Un deseado ajeno o un id mal formado dan el
// mismo 404, para no revelar si existe para otro usuario.
const updateWishlistItem = async (
  userId: string,
  itemId: string,
  body: unknown,
): Promise<WishlistItemDto> => {
  if (!Types.ObjectId.isValid(itemId)) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  const dto = validateUpdateWishlistItemDto(body);

  const update =
    dto.note === undefined
      ? {}
      : dto.note
        ? { $set: { note: dto.note } }
        : { $unset: { note: 1 } };

  const item = await WishlistItem.findOneAndUpdate(
    { _id: itemId, userId },
    update,
    { returnDocument: "after" },
  ).lean();

  const book = item && (await Book.findById(item.bookId).lean());

  if (!item || !book) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  return mapWishlistItemToDto(item, book);
};

// Quita solo el deseado: el Libro es compartido y no se toca.
const removeFromWishlist = async (
  userId: string,
  itemId: string,
): Promise<void> => {
  if (!Types.ObjectId.isValid(itemId)) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  const result = await WishlistItem.deleteOne({ _id: itemId, userId });

  if (result.deletedCount === 0) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }
};

// «Ya lo tengo»: el libro pasa a la biblioteca con las mismas reglas que
// POST /books y el deseado desaparece. Si el usuario ya lo tenía en la
// biblioteca no es un error: se retira el deseado y se devuelve su Ejemplar.
// El Ejemplar se crea antes de borrar el deseado: si algo fallara entre los
// dos pasos, no se pierde el libro.
const acquireFromWishlist = async (
  userId: string,
  itemId: string,
  body: unknown,
): Promise<LibraryItemDto> => {
  if (!Types.ObjectId.isValid(itemId)) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  const { status } = validateAcquireWishlistItemDto(body);

  const item = await WishlistItem.findOne({ _id: itemId, userId }).lean();
  const book = item && (await Book.findById(item.bookId).lean());

  if (!item || !book) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  const existing = await Ejemplar.findOne({ userId, bookId: book._id }).lean();

  let ejemplar = existing;

  if (!ejemplar) {
    try {
      ejemplar = (
        await Ejemplar.create({ userId, bookId: book._id, status })
      ).toObject();
    } catch (error) {
      // Otra petición lo añadió a la biblioteca entre la comprobación y el alta.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      ejemplar = await Ejemplar.findOne({ userId, bookId: book._id }).lean();
    }
  }

  if (!ejemplar) {
    throw WISHLIST_ITEM_NOT_FOUND;
  }

  await WishlistItem.deleteOne({ _id: item._id });

  return { book: mapBookToDto(book), ejemplar: mapEjemplarToDto(ejemplar) };
};

const WishlistService = {
  addToWishlist,
  listWishlist,
  updateWishlistItem,
  removeFromWishlist,
  acquireFromWishlist,
};

export default WishlistService;
