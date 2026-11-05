import pino from "pino";
import config from "../config/index.js";

const level = config.isProduction
  ? "info"
  : config.nodeEnv === "test"
    ? "silent"
    : "debug";

// `pino-http` registra todas las cabeceras de cada petición: sin esto, los
// logs de Render guardaban las cookies de sesión (`accessToken`, `csrfToken`) y
// cualquier token de las cabeceras.
export const logRedaction = {
  paths: [
    "req.headers.cookie",
    "req.headers.authorization",
    'req.headers["x-csrf-token"]',
    'res.headers["set-cookie"]',
  ],
  censor: "[Redacted]",
};

const logger = pino({ level, redact: logRedaction });

export default logger;
