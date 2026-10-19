import { rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const FORGOT_PASSWORD_MAX_REQUESTS = 5;

// Limita las solicitudes de recuperación por IP: cada una envía un correo, así
// que sin límite sirve para spam y para agotar la cuota de Resend.
export const createForgotPasswordRateLimiter = (
  options: Partial<Options> = {},
) =>
  rateLimit({
    windowMs: FORGOT_PASSWORD_WINDOW_MS,
    limit: FORGOT_PASSWORD_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
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
const limitForgotPasswordRequests = createForgotPasswordRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitForgotPasswordRequests;
