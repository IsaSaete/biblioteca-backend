import { Types } from "mongoose";
import ValidationError from "../../../shared/errors/ValidationError.js";
import type { LibrarySort } from "../types/types.js";

// Posición del último elemento entregado: el cursor es opaco para el cliente.
export interface LibraryCursor {
  sort: LibrarySort;
  id: string;
  // Fecha de alta (ISO) con sort=recent; título del Libro con sort=alpha.
  value: string;
}

const invalidCursor = (): ValidationError =>
  new ValidationError("VALIDATION_ERROR", "El cursor no es válido", "cursor");

export const encodeLibraryCursor = (cursor: LibraryCursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString("base64url");

export const decodeLibraryCursor = (
  rawCursor: string,
  sort: LibrarySort,
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
      (sort === "alpha" || !Number.isNaN(Date.parse(parsed.value)))
    ) {
      return { sort, id: parsed.id, value: parsed.value };
    }
  } catch {
    // Se trata igual que cualquier otro cursor manipulado o corrupto.
  }

  throw invalidCursor();
};
