import type { HydratedDocument } from "mongoose";
import Book from "../../books/model/Book.js";
import Ejemplar from "../../books/model/Ejemplar.js";
import mapBookToDto from "../../books/mapper/mapBookToDto.js";
import mapEjemplarToDto from "../../books/mapper/mapEjemplarToDto.js";
import WishlistItem from "../../wishlist/model/WishlistItem.js";
import Quote from "../../quotes/model/Quote.js";
import mapQuoteToDto from "../../quotes/mapper/mapQuoteToDto.js";
import type { UserDocument } from "../model/User.js";
import type { ExportDataDto } from "../types/types.js";

// Todo lo del usuario con las formas que ya devuelve la API: `ejemplar` lleva
// los overrides sin aplicar y las citas, el título ya corregido. Se arma campo a
// campo (nunca se vuelca el documento) para que ningún hash, token ni la foto
// puedan colarse. Sin paginar: es una biblioteca personal.
const exportUserData = async (
  user: HydratedDocument<UserDocument>,
): Promise<ExportDataDto> => {
  const owner = user._id;

  const [ejemplares, quotes, wishlist] = await Promise.all([
    Ejemplar.find({ userId: owner }).sort({ createdAt: 1, _id: 1 }).lean(),
    Quote.find({ userId: owner }).sort({ createdAt: 1, _id: 1 }).lean(),
    WishlistItem.find({ userId: owner }).sort({ createdAt: 1, _id: 1 }).lean(),
  ]);

  const books = await Book.find({
    _id: {
      $in: [...ejemplares, ...wishlist].map((record) => record.bookId),
    },
  }).lean();

  const booksById = new Map(books.map((book) => [book._id.toString(), book]));
  const ejemplarsById = new Map(
    ejemplares.map((ejemplar) => [ejemplar._id.toString(), ejemplar]),
  );

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    books: ejemplares.flatMap((ejemplar) => {
      const book = booksById.get(ejemplar.bookId.toString());

      return book
        ? [{ book: mapBookToDto(book), ejemplar: mapEjemplarToDto(ejemplar) }]
        : [];
    }),
    wishlist: wishlist.flatMap((item) => {
      const book = booksById.get(item.bookId.toString());

      return book
        ? [
            {
              book: mapBookToDto(book),
              ...(item.note && { note: item.note }),
              createdAt: item.createdAt.toISOString(),
            },
          ]
        : [];
    }),
    // Una cita cuyo libro ya no existe se exporta igual, como cita sin libro:
    // el texto es del usuario y la exportación no debe perderlo.
    quotes: quotes.map((quote) => {
      const ejemplar = quote.ejemplarId
        ? ejemplarsById.get(quote.ejemplarId.toString())
        : undefined;
      const book = ejemplar && booksById.get(ejemplar.bookId.toString());

      return ejemplar && book
        ? mapQuoteToDto(quote, ejemplar, book)
        : mapQuoteToDto(quote);
    }),
  };
};

export default exportUserData;
