import { z } from "zod";
import { MAX_QUOTE_LENGTH, MAX_SOURCE_LENGTH } from "../types/types.js";

// Reglas de los campos de una cita, compartidas por el alta y la edición.
export const quoteFieldSchemas = {
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
    .positive("La página no es válida"),
  // Solo en citas sin libro. Una cadena vacía cuenta como no enviada.
  source: z
    .string("La fuente no es válida")
    .trim()
    .max(
      MAX_SOURCE_LENGTH,
      `La fuente no puede tener más de ${MAX_SOURCE_LENGTH} caracteres`,
    ),
};
