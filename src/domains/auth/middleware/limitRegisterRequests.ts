import { rateLimit } from "express-rate-limit";
import type { Options } from "express-rate-limit";
import config from "../../../config/index.js";
import TooManyRequestsError from "../../../shared/errors/TooManyRequestsError.js";

const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_REQUESTS = 10;

// Limita los registros por IP: cada registro envía un correo y calcula un
// hash bcrypt, así que sin límite sirve para spam y para saturar el servidor.
export const createRegisterRateLimiter = (options: Partial<Options> = {}) =>
  rateLimit({
    windowMs: REGISTER_WINDOW_MS,
    limit: REGISTER_MAX_REQUESTS,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          "RATE_LIMITED",
          "Demasiados intentos de registro. Inténtalo de nuevo más tarde",
        ),
      );
    },
    ...options,
  });

// En test se desactiva para no acoplar los tests de endpoints entre sí; el
// comportamiento del límite se prueba con su propio test.
const limitRegisterRequests = createRegisterRateLimiter({
  skip: () => config.nodeEnv === "test",
});

export default limitRegisterRequests;
