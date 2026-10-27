import { z } from "zod";
import ValidationError from "../../../shared/errors/ValidationError.js";
import validateCreateBookDto from "../../books/validator/validateCreateBookDto.js";
import { MAX_NOTE_LENGTH, type AddToWishlistDto } from "../types/types.js";

const noteSchema = z
  .string("La nota no es válida")
  .trim()
  .max(
    MAX_NOTE_LENGTH,
    `La nota no puede superar los ${MAX_NOTE_LENGTH} caracteres`,
  )
  .nullish();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateAddToWishlistDto = (body: unknown): AddToWishlistDto => {
  // El estado de lectura no existe en un deseado: si llega, se ignora.
  const { note, status: _status, ...bookFields } = isRecord(body) ? body : {};

  const book = validateCreateBookDto(isRecord(body) ? bookFields : body);
  const parsedNote = noteSchema.safeParse(note);

  if (!parsedNote.success) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      parsedNote.error.issues[0].message,
      "note",
    );
  }

  return { book, ...(parsedNote.data && { note: parsedNote.data }) };
};

export default validateAddToWishlistDto;
