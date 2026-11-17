import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const VERIFICATION_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const VERIFICATION_EMAIL_MAX_REQUESTS = 3;

// Cada petición envía un correo: sin límite serviría para agotar la cuota de
// Resend o saturar un buzón. Cuenta por usuario, también las fallidas.
export const createVerificationEmailRateLimiter = (
  options: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: VERIFICATION_EMAIL_WINDOW_MS,
    limit: VERIFICATION_EMAIL_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Has pedido demasiados correos de verificación. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitVerificationEmailRequests = createVerificationEmailRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitVerificationEmailRequests;
