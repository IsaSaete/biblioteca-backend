import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import config from "../config/index.js";
import UnauthorizedError from "../shared/errors/UnauthorizedError.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export interface AccessTokenPayload {
  userId: string;
}

const tokenPayloadSchema = z.object({ userId: z.string().min(1) });

export const createAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.accessTokenSecret, { expiresIn: ACCESS_TOKEN_TTL });

// `jwtid` aleatorio: sin él, dos refresh tokens emitidos para el mismo usuario
// en el mismo segundo serían idénticos y la rotación no podría distinguir el
// token viejo del nuevo (rompería la detección de reutilización).
export const createRefreshToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.refreshTokenSecret, {
    expiresIn: REFRESH_TOKEN_TTL,
    jwtid: crypto.randomUUID(),
  });

const verifySessionToken = (
  token: string,
  secret: string,
): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const payload = tokenPayloadSchema.parse(decoded);

    return { userId: payload.userId };
  } catch {
    throw new UnauthorizedError(
      "AUTH_UNAUTHENTICATED",
      "La sesión no es válida o ha caducado",
    );
  }
};

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  verifySessionToken(token, config.accessTokenSecret);

export const verifyRefreshToken = (token: string): AccessTokenPayload =>
  verifySessionToken(token, config.refreshTokenSecret);

export const createCsrfToken = (): string => crypto.randomUUID();

// Token opaco (no JWT) para flujos de un solo uso: verificación de email y
// recuperación de contraseña. Solo se guarda su hash en base de datos, nunca
// el valor en claro, así una fuga de la base de datos no permite reutilizarlo.
export const createRawToken = (): string =>
  crypto.randomBytes(32).toString("hex");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
