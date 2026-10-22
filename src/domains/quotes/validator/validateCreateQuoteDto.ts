import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { MAX_QUOTE_LENGTH, QUOTE_ORIGINS } from "../types/types.js";
import type { CreateQuoteDto } from "../types/types.js";

const createQuoteSchema = z.object({
  ejemplarId: z.string("El libro de la cita es obligatorio").min(1),
  text: z
    .string("El texto de la cita es obligatorio")
    .trim()
    .min(1, "El texto de la cita es obligatorio")
    .max(
      MAX_QUOTE_LENGTH,
      `La cita no puede tener más de ${MAX_QUOTE_LENGTH} caracteres`,
    ),
  page: z
    .number("La página no es válida")
    .int("La página no es válida")
    .positive("La página no es válida")
    .optional(),
  origin: z.enum(QUOTE_ORIGINS, "El origen no es válido").default("manual"),
});

const validateCreateQuoteDto = (body: unknown): CreateQuoteDto => {
  const result = createQuoteSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateCreateQuoteDto;
