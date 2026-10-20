import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import toIsbn13 from "../utils/toIsbn13.js";

const MAX_SEARCH_LENGTH = 200;

const searchSchema = z.object({
  q: z
    .string("Escribe un título o un autor")
    .trim()
    .min(1, "Escribe un título o un autor")
    .max(MAX_SEARCH_LENGTH, "La búsqueda es demasiado larga"),
});

// Devuelve el ISBN-13 normalizado; el ISBN se valida antes de consultar a nadie.
export const validateIsbnQuery = (query: unknown): string => {
  const rawIsbn =
    typeof query === "object" && query !== null && "isbn" in query
      ? query.isbn
      : undefined;
  const isbn = typeof rawIsbn === "string" ? toIsbn13(rawIsbn) : null;

  if (!isbn) {
    throw new ValidationError("INVALID_ISBN", "El ISBN no es válido", "isbn");
  }

  return isbn;
};

export const validateSearchQuery = (query: unknown): string => {
  const result = searchSchema.safeParse(query);

  if (!result.success) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      result.error.issues[0].message,
      "q",
    );
  }

  return result.data.q;
};
