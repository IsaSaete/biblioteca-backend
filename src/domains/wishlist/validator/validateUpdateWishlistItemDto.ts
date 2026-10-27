import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { MAX_NOTE_LENGTH, type UpdateWishlistItemDto } from "../types/types.js";

const updateWishlistItemSchema = z.object({
  note: z
    .string("La nota no es válida")
    .trim()
    .max(
      MAX_NOTE_LENGTH,
      `La nota no puede superar los ${MAX_NOTE_LENGTH} caracteres`,
    )
    .nullable()
    .optional(),
});

const validateUpdateWishlistItemDto = (
  body: unknown,
): UpdateWishlistItemDto => {
  const result = updateWishlistItemSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateUpdateWishlistItemDto;
