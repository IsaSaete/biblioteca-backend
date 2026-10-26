import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const WRONG_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const WRONG_PASSWORD_MAX_ATTEMPTS = 5;

// Frena el uso de estos endpoints para adivinar la contraseña con una sesión
// robada. La clave es el usuario (ya hay sesión), no la IP, y el contador es
// único para todos los endpoints donde se usa: con uno por endpoint habría
// 5 intentos por cada uno. Solo cuenta la contraseña incorrecta (401): un 400
// de validación o un éxito no gastan intentos.
export const createWrongPasswordRateLimiter = (
  options: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: WRONG_PASSWORD_WINDOW_MS,
    limit: WRONG_PASSWORD_MAX_ATTEMPTS,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiados intentos con la contraseña incorrecta. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitWrongPasswordAttempts = createWrongPasswordRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitWrongPasswordAttempts;
