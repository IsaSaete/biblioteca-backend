import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ResetPasswordDto } from "../types/types.js";
import { passwordSchema } from "./validateRegisterDto.js";

// La nueva contraseña cumple los mismos requisitos que en el registro.
const resetPasswordSchema = z.object({
  token: z.string().min(1, "El enlace de recuperación no es válido"),
  newPassword: passwordSchema,
});

const validateResetPasswordDto = (body: unknown): ResetPasswordDto => {
  const result = resetPasswordSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;
    const code =
      field === "newPassword" ? "AUTH_WEAK_PASSWORD" : "VALIDATION_ERROR";

    throw new ValidationError(code, firstIssue.message, field);
  }

  return result.data;
};

export default validateResetPasswordDto;
