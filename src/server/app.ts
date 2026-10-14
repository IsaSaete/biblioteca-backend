import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import handleCors from "../middleware/handleCors.js";
import handleError from "../middleware/handleError.js";
import handleEndpointNotFound from "../middleware/handleEndpointNotFound.js";
import logger from "../utils/logger.js";
import authRouter from "../domains/auth/router/authRouter.js";

const app = express();

app.use(helmet());
app.use(handleCors);
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.use("/auth", authRouter);

app.use(handleEndpointNotFound);
app.use(handleError);

export default app;
