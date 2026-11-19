import type AppError from "../shared/errors/AppError.js";
import PayloadTooLargeError from "../shared/errors/PayloadTooLargeError.js";
import ValidationError from "../shared/errors/ValidationError.js";

// `express.json()` rechaza el cuerpo con un error propio (de `body-parser`) que
// no es un AppError: sin traducirlo, un JSON mal formado o un cuerpo demasiado
// grande acababan en un 500 y en una línea de «Unhandled error» en el registro,
// como si fueran un fallo nuestro. Son errores de quien llama: 400 y 413.
const getBodyParserErrorType = (error: unknown): string | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string" &&
    error.type.startsWith("entity.")
  ) {
    return error.type;
  }

  return undefined;
};

const mapBodyParserError = (error: unknown): AppError | undefined => {
  const type = getBodyParserErrorType(error);

  if (type === "entity.parse.failed") {
    return new ValidationError(
      "VALIDATION_ERROR",
      "El cuerpo de la petición no es un JSON válido",
    );
  }

  if (type === "entity.too.large") {
    return new PayloadTooLargeError(
      "VALIDATION_ERROR",
      "El cuerpo de la petición es demasiado grande",
    );
  }

  if (type === "entity.verify.failed") {
    return new ValidationError(
      "VALIDATION_ERROR",
      "El cuerpo de la petición no es válido",
    );
  }

  return undefined;
};

export default mapBodyParserError;
