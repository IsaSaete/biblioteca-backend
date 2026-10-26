import express from "express";
import type { NextFunction, Request, Response } from "express";
import PayloadTooLargeError from "../../../shared/errors/PayloadTooLargeError.js";
import { AVATAR_CONTENT_TYPE, AVATAR_MAX_BYTES } from "../types/types.js";

const parseRawJpeg = express.raw({
  type: AVATAR_CONTENT_TYPE,
  limit: AVATAR_MAX_BYTES,
});

// Lee el cuerpo binario de la foto. Solo `image/jpeg` se parsea: con otro tipo
// `req.body` no llega como Buffer y lo rechaza el validador. Pasar del límite se
// traduce aquí porque body-parser lanza un error que handleError no conoce.
const parseAvatarBody = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  parseRawJpeg(req, res, (error?: unknown) => {
    const isTooLarge =
      error instanceof Error &&
      "type" in error &&
      error.type === "entity.too.large";

    if (isTooLarge) {
      next(
        new PayloadTooLargeError(
          "VALIDATION_ERROR",
          "La foto supera los 200 KB",
          "avatar",
        ),
      );
      return;
    }

    next(error);
  });
};

export default parseAvatarBody;
