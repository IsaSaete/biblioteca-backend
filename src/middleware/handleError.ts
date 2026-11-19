import type { NextFunction, Request, Response } from "express";
import AppError from "../shared/errors/AppError.js";
import logger from "../utils/logger.js";
import mapBodyParserError from "./mapBodyParserError.js";

const handleError = (
  error: unknown,
  req: Request,
  res: Response,
  // Express solo reconoce un middleware como manejador de errores si recibe 4 parámetros.
  _next: NextFunction,
): void => {
  const appError =
    error instanceof AppError ? error : mapBodyParserError(error);

  if (appError) {
    res.status(appError.httpStatus).json({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.field && { field: appError.field }),
      },
    });
    return;
  }

  logger.error(error, "Unhandled error");

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Ha ocurrido un error inesperado",
    },
  });
};

export default handleError;
