import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { RequestEmailChangeDto } from "../types/types.js";

const requestEmailChangeSchema = z.object({
  // Se normaliza antes de validar: z.email() rechazaría los espacios sobrantes.
  newEmail: z
    .string("El email no es válido")
    .trim()
    .toLowerCase()
    .pipe(z.email("El email no es válido")),
  currentPassword: z
    .string("La contraseña actual es obligatoria")
    .min(1, "La contraseña actual es obligatoria"),
});

const validateRequestEmailChangeDto = (
  body: unknown,
): RequestEmailChangeDto => {
  const result = requestEmailChangeSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateRequestEmailChangeDto;
