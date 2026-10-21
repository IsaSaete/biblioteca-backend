import { z } from "zod";

export const requiredText = (message: string) =>
  z.string().trim().min(1, message);

export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

// Reglas de los campos editables de Libro, compartidas por el alta y por los
// overrides del Ejemplar.
export const bookFieldSchemas = {
  title: requiredText("El título es obligatorio"),
  authors: z
    .array(requiredText("El nombre del autor no puede estar vacío"))
    .min(1, "Indica al menos un autor"),
  publisher: requiredText("La editorial es obligatoria"),
  publishedYear: z
    .number("El año de publicación no es válido")
    .int("El año de publicación no es válido")
    .min(1, "El año de publicación no es válido")
    .max(9999, "El año de publicación no es válido"),
  pageCount: z
    .number("El número de páginas no es válido")
    .int("El número de páginas no es válido")
    .positive("El número de páginas no es válido"),
  categories: z.array(requiredText("La categoría no puede estar vacía")),
};
