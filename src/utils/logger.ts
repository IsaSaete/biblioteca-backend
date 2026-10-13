import pino from "pino";
import config from "../config/index.js";

const logger = pino({
  level: config.isProduction ? "info" : "debug",
});

export default logger;
