import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ListLibraryQuery } from "../types/types.js";

export const MAX_SEARCH_LENGTH = 100;

const listLibraryQuerySchema = z
  .object({
    // Un texto vacío o solo de espacios equivale a no buscar.
    search: z
      .string("La búsqueda no es válida")
      .trim()
      .max(
        MAX_SEARCH_LENGTH,
        `La búsqueda no puede tener más de ${MAX_SEARCH_LENGTH} caracteres`,
      )
      .optional()
      .transform((value) => value || undefined),
    // Un texto vacío o solo de espacios equivale a no filtrar.
    tag: z
      .string("La etiqueta no es válida")
      .trim()
      .max(
        MAX_SEARCH_LENGTH,
        `La etiqueta no puede tener más de ${MAX_SEARCH_LENGTH} caracteres`,
      )
      .optional()
      .transform((value) => value || undefined),
    // Libros sin ninguna etiqueta («Sin catalogar»); no se combina con `tag`.
    untagged: z
      .enum(["true", "false"], "El filtro de sin catalogar no es válido")
      .default("false")
      .transform((value) => value === "true"),
    // Solo `true` filtra; `false` o ausente equivale a no filtrar.
    favorite: z
      .enum(["true", "false"], "El filtro de favoritos no es válido")
      .default("false")
      .transform((value) => value === "true"),
    sort: z
      .enum(["recent", "oldest", "alpha"], "El orden no es válido")
      .default("recent"),
    cursor: z.string().min(1, "El cursor no es válido").optional(),
  })
  .refine((query) => !query.untagged || !query.tag, {
    path: ["untagged"],
    message: "No se puede filtrar por etiqueta y por libros sin catalogar",
  });

const validateListLibraryQuery = (query: unknown): ListLibraryQuery => {
  const result = listLibraryQuerySchema.safeParse(query);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateListLibraryQuery;
