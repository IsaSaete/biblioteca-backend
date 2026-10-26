import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const EMAIL_CHANGE_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_MAX_REQUESTS = 5;

// Cada petición válida envía dos correos: sin límite sirve para mandar spam a
// una dirección ajena y para agotar la cuota de Resend. Cuenta todas las
// peticiones por usuario, también las fallidas.
export const createEmailChangeRateLimiter = (options: Partial<Options> = {}) =>
  rateLimit({
    windowMs: EMAIL_CHANGE_WINDOW_MS,
    limit: EMAIL_CHANGE_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiadas solicitudes de cambio de email. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitEmailChangeRequests = createEmailChangeRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitEmailChangeRequests;
