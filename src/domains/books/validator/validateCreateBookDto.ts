import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { COVER_SOURCES, READING_STATUSES } from "../types/types.js";
import type { CreateBookDto } from "../types/types.js";
import toIsbn13 from "../utils/toIsbn13.js";
import { bookFieldSchemas, optionalText } from "./bookFieldSchemas.js";
import { FIELD_LIMITS, messages } from "./fieldLimits.js";

const COVER_HOSTS = {
  google_books: ["books.google.com"],
  open_library: ["covers.openlibrary.org"],
} as const satisfies Record<(typeof COVER_SOURCES)[number], readonly string[]>;

const isCoverFromSource = (
  coverUrl: string,
  source: (typeof COVER_SOURCES)[number],
): boolean => {
  const hosts: readonly string[] = COVER_HOSTS[source];

  try {
    return hosts.includes(new URL(coverUrl).hostname);
  } catch {
    return false;
  }
};

// La CSP del frontend solo admite imágenes por https.
const toHttps = (coverUrl: string): string => {
  const url = new URL(coverUrl);
  url.protocol = "https:";

  return url.toString();
};

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
    language: optionalText(FIELD_LIMITS.language, messages.language),
    coverUrl: z
      .url({
        protocol: /^https?$/,
        error: messages.coverUrl,
      })
      .max(FIELD_LIMITS.coverUrl, messages.coverUrl)
      .optional(),
    coverSource: z.enum(COVER_SOURCES).optional(),
    synopsis: optionalText(FIELD_LIMITS.synopsis, messages.synopsis),
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
  })
  // El Libro es compartido: la portada que fija la primera persona que añade un
  // ISBN la ven todas. Solo se admite la que viene del proveedor declarado.
  .refine(
    (dto) =>
      !dto.coverUrl ||
      !dto.coverSource ||
      isCoverFromSource(dto.coverUrl, dto.coverSource),
    { path: ["coverUrl"], message: messages.coverUrl },
  )
  .transform((dto) => ({
    ...dto,
    ...(dto.coverUrl && { coverUrl: toHttps(dto.coverUrl) }),
  }));

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
