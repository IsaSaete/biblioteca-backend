import { rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";
import getEmailRateLimitKey from "./getEmailRateLimitKey.js";

const ACCOUNT_LOGIN_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_LOGIN_MAX_FAILED_ATTEMPTS = 10;

// Segundo freno al login, por cuenta y sin mirar la IP: el límite por IP + email
// depende de que Express lea bien la IP del cliente, y quien llame directamente
// a Render puede falsearla en `X-Forwarded-For` para esquivarlo. Este cuenta los
// fallos de un mismo email, venga de donde venga. Solo cuentan los fallidos.
export const createLoginAccountRateLimiter = (options: Partial<Options> = {}) =>
  rateLimit({
    windowMs: ACCOUNT_LOGIN_WINDOW_MS,
    limit: ACCOUNT_LOGIN_MAX_FAILED_ATTEMPTS,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: getEmailRateLimitKey,
    skip: (req) => !getEmailRateLimitKey(req),
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
const limitLoginAttemptsPerAccount = createLoginAccountRateLimiter({
  skip: (req) => config.nodeEnv === "test" || !getEmailRateLimitKey(req),
});

export default limitLoginAttemptsPerAccount;
