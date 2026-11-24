import { z } from "zod";
import { FIELD_LIMITS, messages } from "./fieldLimits.js";

export const requiredText = (message: string) =>
  z.string().trim().min(1, message);

export const optionalText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .optional()
    .transform((value) => value || undefined);

// Reglas de los campos editables de Libro, compartidas por el alta y por los
// overrides del Ejemplar.
export const bookFieldSchemas = {
  title: requiredText("El título es obligatorio").max(
    FIELD_LIMITS.title,
    messages.title,
  ),
  authors: z
    .array(
      requiredText("El nombre del autor/a no puede estar vacío").max(
        FIELD_LIMITS.author,
        messages.author,
      ),
    )
    .min(1, "Indica al menos un autor/a")
    .max(FIELD_LIMITS.authors, messages.authors),
  publisher: requiredText("La editorial es obligatoria").max(
    FIELD_LIMITS.publisher,
    messages.publisher,
  ),
  publishedYear: z
    .number("El año de publicación no es válido")
    .int("El año de publicación no es válido")
    .min(1, "El año de publicación no es válido")
    .max(9999, "El año de publicación no es válido"),
  pageCount: z
    .number("El número de páginas no es válido")
    .int("El número de páginas no es válido")
    .positive("El número de páginas no es válido"),
  categories: z
    .array(
      requiredText("La categoría no puede estar vacía").max(
        FIELD_LIMITS.category,
        messages.category,
      ),
    )
    .max(FIELD_LIMITS.categories, messages.categories),
};
