import pino from "pino";
import config from "../config/index.js";

const level = config.isProduction
  ? "info"
  : config.nodeEnv === "test"
    ? "silent"
    : "debug";

const logger = pino({ level });

export default logger;
