import type { Types } from "mongoose";
import type { BookRecord } from "../../books/mapper/mapBookToDto.js";
import type { EjemplarRecord } from "../../books/mapper/mapEjemplarToDto.js";
import type { QuoteDocument } from "../model/Quote.js";
import type { QuoteDto } from "../types/types.js";

export type QuoteRecord = QuoteDocument & { _id: Types.ObjectId };

// El título y los autores llevan ya las correcciones del usuario (overrides).
const mapQuoteToDto = (
  quote: QuoteRecord,
  ejemplar: EjemplarRecord,
  book: BookRecord,
): QuoteDto => ({
  id: quote._id.toString(),
  ejemplarId: quote.ejemplarId.toString(),
  text: quote.text,
  ...(typeof quote.page === "number" && { page: quote.page }),
  createdAt: quote.createdAt.toISOString(),
  book: {
    id: book._id.toString(),
    title: ejemplar.overrides?.title ?? book.title,
    authors: [...(ejemplar.overrides?.authors ?? book.authors)],
  },
});

export default mapQuoteToDto;
