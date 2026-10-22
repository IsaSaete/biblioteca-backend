import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { UpdateQuoteDto } from "../types/types.js";
import { quoteFieldSchemas } from "./quoteFieldSchemas.js";

const updateQuoteSchema = z.object({
  text: quoteFieldSchemas.text.optional(),
  page: quoteFieldSchemas.page.nullable().optional(),
  // Una cadena vacía borra la fuente, igual que `null`.
  source: quoteFieldSchemas.source
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

const validateUpdateQuoteDto = (body: unknown): UpdateQuoteDto => {
  const result = updateQuoteSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateUpdateQuoteDto;
