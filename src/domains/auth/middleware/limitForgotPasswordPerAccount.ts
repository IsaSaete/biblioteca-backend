import { rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";
import getEmailRateLimitKey from "./getEmailRateLimitKey.js";

const ACCOUNT_FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const ACCOUNT_FORGOT_PASSWORD_MAX_REQUESTS = 3;

// Segundo freno a «olvidé mi contraseña», por email y sin mirar la IP: evita
// que alguien llene de correos la bandeja de una persona (y gaste la cuota de
// Resend) cambiando de IP o falseándola. El 429 se da igual exista o no la
// cuenta, así que no revela nada.
export const createForgotPasswordAccountRateLimiter = (
  options: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: ACCOUNT_FORGOT_PASSWORD_WINDOW_MS,
    limit: ACCOUNT_FORGOT_PASSWORD_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: getEmailRateLimitKey,
    skip: (req) => !getEmailRateLimitKey(req),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiadas solicitudes de recuperación. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitForgotPasswordPerAccount = createForgotPasswordAccountRateLimiter({
  skip: (req) => config.nodeEnv === "test" || !getEmailRateLimitKey(req),
});

export default limitForgotPasswordPerAccount;
