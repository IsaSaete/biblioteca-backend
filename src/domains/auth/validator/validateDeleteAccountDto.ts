import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { DeleteAccountDto } from "../types/types.js";

const deleteAccountSchema = z.object({
  password: z
    .string("La contraseña es obligatoria")
    .min(1, "La contraseña es obligatoria"),
});

const validateDeleteAccountDto = (body: unknown): DeleteAccountDto => {
  const result = deleteAccountSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateDeleteAccountDto;
