import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 5;

// Frena la fuerza bruta sobre una cuenta concreta: la clave es IP + email, así
// un atacante no agota el límite de otros usuarios ni uno legítimo queda
// bloqueado por el email de otro. Solo cuentan los intentos fallidos.
export const createLoginRateLimiter = (options: Partial<Options> = {}) =>
  rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_MAX_FAILED_ATTEMPTS,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email: unknown = req.body?.email;
      const normalizedEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";

      return `${ipKeyGenerator(req.ip ?? "")}|${normalizedEmail}`;
    },
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitLoginRequests = createLoginRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitLoginRequests;
