import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const EXPORT_WINDOW_MS = 60 * 60 * 1000;
const EXPORT_MAX_REQUESTS = 5;

// Cada exportación recorre toda la biblioteca y las citas del usuario: sin
// límite, un bucle desde una sesión robada carga la base de datos. Cuenta todas
// las peticiones por usuario.
export const createExportRateLimiter = (options: Partial<Options> = {}) =>
  rateLimit({
    windowMs: EXPORT_WINDOW_MS,
    limit: EXPORT_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiadas exportaciones. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitExportRequests = createExportRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitExportRequests;
