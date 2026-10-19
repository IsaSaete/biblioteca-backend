import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { RegisterUserDto } from "../types/types.js";

// Requisitos de pantallas-y-flujos.md: mínimo 8 caracteres, una mayúscula,
// un número y un símbolo. Cada uno es su propio refine para poder decir
// exactamente qué requisito falló (api-contract.md exige el campo en los
// errores de formulario).
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .refine((value) => /[A-Z]/.test(value), {
    message: "La contraseña debe incluir al menos una mayúscula",
  })
  .refine((value) => /[0-9]/.test(value), {
    message: "La contraseña debe incluir al menos un número",
  })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: "La contraseña debe incluir al menos un símbolo",
  });

const registerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  email: z.email("El email no es válido").trim().toLowerCase(),
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    error: "Debes aceptar los Términos y la Política de Privacidad",
  }),
});

const validateRegisterDto = (body: unknown): RegisterUserDto => {
  const result = registerSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;
    const code =
      field === "password" ? "AUTH_WEAK_PASSWORD" : "VALIDATION_ERROR";

    throw new ValidationError(code, firstIssue.message, field);
  }

  return result.data;
};

export default validateRegisterDto;
