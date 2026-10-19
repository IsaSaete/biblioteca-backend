import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { LoginUserDto } from "../types/types.js";

// No se aplican los requisitos de fuerza de contraseña del registro: en login
// solo importa que venga informada; si no coincide, el error es genérico.
const loginSchema = z.object({
  email: z.email("El email no es válido").trim().toLowerCase(),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

const validateLoginDto = (body: unknown): LoginUserDto => {
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateLoginDto;
