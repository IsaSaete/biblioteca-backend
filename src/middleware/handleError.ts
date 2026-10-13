import type { NextFunction, Request, Response } from "express";
import AppError from "../shared/errors/AppError.js";
import logger from "../utils/logger.js";

const handleError = (
  error: unknown,
  req: Request,
  res: Response,
  // Express solo reconoce un middleware como manejador de errores si recibe 4 parámetros.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void => {
  if (error instanceof AppError) {
    res.status(error.httpStatus).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.field && { field: error.field }),
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
