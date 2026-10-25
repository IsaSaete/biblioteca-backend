import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import { LIBRARY_VIEWS, type UpdatePreferencesDto } from "../types/types.js";

const updatePreferencesSchema = z.object({
  libraryView: z.enum(LIBRARY_VIEWS, "La vista no es válida").optional(),
});

const validateUpdatePreferencesDto = (body: unknown): UpdatePreferencesDto => {
  const result = updatePreferencesSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  return result.data;
};

export default validateUpdatePreferencesDto;
