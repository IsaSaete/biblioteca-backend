import type { Types } from "mongoose";
import type { EjemplarDocument } from "../model/Ejemplar.js";
import type { BookEditableFields, EjemplarDto } from "../types/types.js";

export type EjemplarRecord = EjemplarDocument & { _id: Types.ObjectId };

// Mongoose rellena con undefined las claves ausentes de un subdocumento al
// hidratarlo: se descartan para no devolver overrides vacíos.
const compactOverrides = (
  overrides: EjemplarRecord["overrides"],
): Partial<BookEditableFields> | undefined => {
  if (!overrides) {
    return undefined;
  }

  const entries = Object.entries(overrides).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const mapEjemplarToDto = (ejemplar: EjemplarRecord): EjemplarDto => {
  const overrides = compactOverrides(ejemplar.overrides);

  return {
    id: ejemplar._id.toString(),
    bookId: ejemplar.bookId.toString(),
    status: ejemplar.status,
    favorite: ejemplar.favorite ?? false,
    ...(ejemplar.location && { location: ejemplar.location }),
    ...(ejemplar.format && { format: ejemplar.format }),
    ...(ejemplar.provenance && { provenance: ejemplar.provenance }),
    ...(ejemplar.acquisitionDate && {
      acquisitionDate: ejemplar.acquisitionDate.toISOString().slice(0, 10),
    }),
    ...(ejemplar.notes && { notes: ejemplar.notes }),
    ...(ejemplar.tags &&
      ejemplar.tags.length > 0 && { tags: [...ejemplar.tags] }),
    ...(overrides && { overrides }),
    createdAt: ejemplar.createdAt.toISOString(),
  };
};

export default mapEjemplarToDto;
