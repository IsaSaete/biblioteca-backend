import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { COVER_SOURCES, READING_STATUSES } from "../types/types.js";
import type { CreateBookDto } from "../types/types.js";
import toIsbn13 from "../utils/toIsbn13.js";

const requiredText = (message: string) => z.string().trim().min(1, message);

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

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
    title: requiredText("El título es obligatorio"),
    authors: z
      .array(requiredText("El nombre del autor no puede estar vacío"))
      .min(1, "Indica al menos un autor"),
    publisher: requiredText("La editorial es obligatoria"),
    publishedYear: z
      .number("El año de publicación no es válido")
      .int("El año de publicación no es válido")
      .min(1, "El año de publicación no es válido")
      .max(9999, "El año de publicación no es válido")
      .optional(),
    pageCount: z
      .number("El número de páginas no es válido")
      .int("El número de páginas no es válido")
      .positive("El número de páginas no es válido")
      .optional(),
    language: optionalText,
    coverUrl: z
      .url({
        protocol: /^https?$/,
        error: "La URL de la portada no es válida",
      })
      .optional(),
    coverSource: z.enum(COVER_SOURCES).optional(),
    synopsis: optionalText,
    categories: z
      .array(requiredText("La categoría no puede estar vacía"))
      .optional(),
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
