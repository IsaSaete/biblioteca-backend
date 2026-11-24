import { Types } from "mongoose";
import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";

const randomBookQuerySchema = z.object({
  // El libro que no debe salir (el último sugerido), para no repetirlo.
  exclude: z
    .string("El libro a excluir no es válido")
    .refine(
      (value) => Types.ObjectId.isValid(value),
      "El libro a excluir no es válido",
    )
    .optional(),
});

export interface RandomBookQuery {
  exclude?: string;
}

const validateRandomBookQuery = (query: unknown): RandomBookQuery => {
  const result = randomBookQuerySchema.safeParse(query);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateRandomBookQuery;
