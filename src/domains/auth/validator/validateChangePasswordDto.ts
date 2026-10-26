import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { ChangePasswordDto } from "../types/types.js";
import { passwordSchema } from "./validateRegisterDto.js";

// La contraseña actual no se valida contra los requisitos: solo se compara con
// la guardada. La nueva cumple los mismos requisitos que en el registro.
const changePasswordSchema = z.object({
  currentPassword: z
    .string("La contraseña actual es obligatoria")
    .min(1, "La contraseña actual es obligatoria"),
  newPassword: passwordSchema,
});

const validateChangePasswordDto = (body: unknown): ChangePasswordDto => {
  const result = changePasswordSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;
    const code =
      field === "newPassword" ? "AUTH_WEAK_PASSWORD" : "VALIDATION_ERROR";

    throw new ValidationError(code, firstIssue.message, field);
  }

  return result.data;
};

export default validateChangePasswordDto;
