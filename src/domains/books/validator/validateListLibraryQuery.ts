import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ListLibraryQuery } from "../types/types.js";

const listLibraryQuerySchema = z.object({
  sort: z.enum(["recent", "alpha"], "El orden no es válido").default("recent"),
  cursor: z.string().min(1, "El cursor no es válido").optional(),
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
