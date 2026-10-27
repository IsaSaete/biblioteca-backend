import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { READING_STATUSES } from "../../books/types/types.js";
import type { AcquireWishlistItemDto } from "../types/types.js";

const acquireSchema = z.object({
  status: z.enum(READING_STATUSES, "El estado no es válido").default("pending"),
});

const validateAcquireWishlistItemDto = (
  body: unknown,
): AcquireWishlistItemDto => {
  // Sin cuerpo, Express deja `req.body` sin definir: es una petición válida.
  const result = acquireSchema.safeParse(body ?? {});

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateAcquireWishlistItemDto;
