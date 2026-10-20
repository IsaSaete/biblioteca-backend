import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const EXTERNAL_BOOKS_WINDOW_MS = 60 * 1000;
const EXTERNAL_BOOKS_MAX_REQUESTS = 30;

// Protege la cuota gratuita de Google Books: la clave es el usuario de la
// sesión (authMiddleware va antes), no la IP, que en Render es compartida.
export const createExternalBooksRateLimiter = (
  options: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: EXTERNAL_BOOKS_WINDOW_MS,
    limit: EXTERNAL_BOOKS_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiadas búsquedas de libros. Espera un minuto e inténtalo de nuevo",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitExternalBookRequests = createExternalBooksRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitExternalBookRequests;
