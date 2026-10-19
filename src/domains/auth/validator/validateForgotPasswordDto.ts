import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ForgotPasswordDto } from "../types/types.js";

const forgotPasswordSchema = z.object({
  email: z.email("El email no es válido").trim().toLowerCase(),
});

const validateForgotPasswordDto = (body: unknown): ForgotPasswordDto => {
  const result = forgotPasswordSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateForgotPasswordDto;
