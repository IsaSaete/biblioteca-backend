import ConflictError from "../../../shared/errors/ConflictError.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import findOrCreateBook from "../../books/service/findOrCreateBook.js";
import isDuplicateKeyError from "../../books/utils/isDuplicateKeyError.js";
import WishlistItem from "../model/WishlistItem.js";
import mapWishlistItemToDto from "../mapper/mapWishlistItemToDto.js";
import validateAddToWishlistDto from "../validator/validateAddToWishlistDto.js";
import type { WishlistItemDto } from "../types/types.js";

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

const WishlistService = { addToWishlist };

export default WishlistService;
