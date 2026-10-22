import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ListQuotesQuery } from "../types/types.js";

const listQuotesQuerySchema = z
  .object({
    bookId: z.string("El libro no es válido").min(1).optional(),
    unlinked: z
      .enum(["true", "false"], "El filtro no es válido")
      .default("false")
      .transform((value) => value === "true"),
    cursor: z.string().min(1, "El cursor no es válido").optional(),
  })
  .refine((query) => !query.unlinked || !query.bookId, {
    path: ["unlinked"],
    message: "No se puede filtrar por libro y por citas sin libro a la vez",
  });

const validateListQuotesQuery = (query: unknown): ListQuotesQuery => {
  const result = listQuotesQuerySchema.safeParse(query);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateListQuotesQuery;
