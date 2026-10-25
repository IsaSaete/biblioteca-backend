import { Types } from "mongoose";
import ValidationError from "../../../shared/errors/ValidationError.js";

// Órdenes cuyo `value` es un texto (el título); en los demás es una fecha ISO.
const TEXT_SORTS: ReadonlySet<string> = new Set([
  "alpha",
  "alpha_desc",
  "book",
  "book_desc",
]);

// Posición del último elemento entregado: el cursor es opaco para el cliente.
// Sirve a los listados con cursor de Biblioteca y de Citas.
export interface LibraryCursor {
  sort: string;
  id: string;
  // Título con un orden alfabético (`alpha`, `alpha_desc`, `book`, `book_desc`); fecha ISO con los demás.
  value: string;
}

const invalidCursor = (): ValidationError =>
  new ValidationError("VALIDATION_ERROR", "El cursor no es válido", "cursor");

export const encodeLibraryCursor = (cursor: LibraryCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export const decodeLibraryCursor = (
  rawCursor: string,
  sort: string,
): LibraryCursor => {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(rawCursor, "base64url").toString("utf8"),
    );

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sort" in parsed &&
      "id" in parsed &&
      "value" in parsed &&
      parsed.sort === sort &&
      typeof parsed.id === "string" &&
      Types.ObjectId.isValid(parsed.id) &&
      typeof parsed.value === "string" &&
      (TEXT_SORTS.has(sort) || !Number.isNaN(Date.parse(parsed.value)))
    ) {
      return { sort, id: parsed.id, value: parsed.value };
    }
  } catch {
    // Se trata igual que cualquier otro cursor manipulado o corrupto.
  }

  throw invalidCursor();
};
