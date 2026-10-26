import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { UpdateProfileDto } from "../types/types.js";

const updateProfileSchema = z.object({
  name: z
    .string("El nombre no es válido")
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(80, "El nombre no puede superar los 80 caracteres"),
});

const validateUpdateProfileDto = (body: unknown): UpdateProfileDto => {
  const result = updateProfileSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || "name";

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateUpdateProfileDto;
