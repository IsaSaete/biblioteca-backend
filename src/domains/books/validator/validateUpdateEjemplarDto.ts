import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import {
  FORMATS,
  MAX_TAGS,
  PROVENANCES,
  READING_STATUSES,
} from "../types/types.js";
import type { UpdateEjemplarDto } from "../types/types.js";
import { bookFieldSchemas, requiredText } from "./bookFieldSchemas.js";

// Texto libre que se puede borrar: `null` o cadena vacía dejan el campo vacío.
const clearableText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value));

const clearable = <T extends z.ZodType>(schema: T) =>
  schema.nullable().optional();

const updateEjemplarSchema = z.object({
  status: z.enum(READING_STATUSES).optional(),
  location: clearableText,
  format: clearable(z.enum(FORMATS)),
  provenance: clearable(z.enum(PROVENANCES)),
  acquisitionDate: clearable(
    z.iso.date("La fecha de adquisición no es válida"),
  ),
  notes: clearableText,
  tags: z.array(requiredText("La etiqueta no puede estar vacía")).optional(),
  favorite: z.boolean("El favorito no es válido").optional(),
  overrides: z
    .object({
      title: clearable(bookFieldSchemas.title),
      authors: clearable(bookFieldSchemas.authors),
      publisher: clearable(bookFieldSchemas.publisher),
      publishedYear: clearable(bookFieldSchemas.publishedYear),
      pageCount: clearable(bookFieldSchemas.pageCount),
      language: clearableText,
      synopsis: clearableText,
      categories: clearable(bookFieldSchemas.categories),
    })
    .optional(),
});

// "Sci-Fi" y "sci-fi" son la misma etiqueta: se conserva la primera.
const dedupeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase("es");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const validateUpdateEjemplarDto = (body: unknown): UpdateEjemplarDto => {
  const result = updateEjemplarSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join(".") || undefined;

    throw new ValidationError("VALIDATION_ERROR", firstIssue.message, field);
  }

  const { tags, ...rest } = result.data;
  const uniqueTags = tags && dedupeTags(tags);

  if (uniqueTags && uniqueTags.length > MAX_TAGS) {
    throw new ValidationError(
      "TAG_LIMIT_EXCEEDED",
      `Un libro admite como máximo ${MAX_TAGS} etiquetas`,
      "tags",
    );
  }

  return { ...rest, ...(uniqueTags && { tags: uniqueTags }) };
};

export default validateUpdateEjemplarDto;
