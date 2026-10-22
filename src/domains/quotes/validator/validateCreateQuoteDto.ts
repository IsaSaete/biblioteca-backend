import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { QUOTE_ORIGINS } from "../types/types.js";
import type { CreateQuoteDto } from "../types/types.js";
import { quoteFieldSchemas } from "./quoteFieldSchemas.js";

const createQuoteSchema = z
  .object({
    ejemplarId: z.string("El libro de la cita no es válido").min(1).optional(),
    text: quoteFieldSchemas.text,
    page: quoteFieldSchemas.page.optional(),
    source: quoteFieldSchemas.source
      .optional()
      .transform((value) => value || undefined),
    origin: z.enum(QUOTE_ORIGINS, "El origen no es válido").default("manual"),
  })
  .refine((dto) => !dto.ejemplarId || !dto.source, {
    path: ["source"],
    message: "Solo las citas sin libro llevan fuente",
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
