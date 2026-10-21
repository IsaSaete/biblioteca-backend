import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { COVER_SOURCES, READING_STATUSES } from "../types/types.js";
import type { CreateBookDto } from "../types/types.js";
import toIsbn13 from "../utils/toIsbn13.js";
import { bookFieldSchemas, optionalText } from "./bookFieldSchemas.js";

const createBookSchema = z
  .object({
    isbn: z
      .string()
      .optional()
      .transform((value, context) => {
        if (value === undefined || value.trim() === "") {
          return undefined;
        }

        const isbn = toIsbn13(value);

        if (!isbn) {
          context.addIssue({
            code: "custom",
            message: "El ISBN no es válido",
          });
          return z.NEVER;
        }

        return isbn;
      }),
    title: bookFieldSchemas.title,
    authors: bookFieldSchemas.authors,
    publisher: bookFieldSchemas.publisher,
    publishedYear: bookFieldSchemas.publishedYear.optional(),
    pageCount: bookFieldSchemas.pageCount.optional(),
    language: optionalText,
    coverUrl: z
      .url({
        protocol: /^https?$/,
        error: "La URL de la portada no es válida",
      })
      .optional(),
    coverSource: z.enum(COVER_SOURCES).optional(),
    synopsis: optionalText,
    categories: bookFieldSchemas.categories.optional(),
    status: z.enum(READING_STATUSES).default("pending"),
  })
  .refine((dto) => !dto.coverUrl || dto.coverSource, {
    path: ["coverSource"],
    message: "Indica de qué proveedor viene la portada",
  })
  .refine((dto) => !dto.coverSource || dto.coverUrl, {
    path: ["coverUrl"],
    message: "La portada necesita una URL",
  });

const validateCreateBookDto = (body: unknown): CreateBookDto => {
  const result = createBookSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    if (field === "isbn") {
      throw new ValidationError("INVALID_ISBN", firstIssue.message, field);
    }

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateCreateBookDto;
