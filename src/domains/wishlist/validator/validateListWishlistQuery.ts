import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";

const listWishlistQuerySchema = z.object({
  cursor: z.string().min(1, "El cursor no es válido").optional(),
});

const validateListWishlistQuery = (query: unknown): { cursor?: string } => {
  const result = listWishlistQuerySchema.safeParse(query);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateListWishlistQuery;
