import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import config from "../config/index.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

export interface AccessTokenPayload {
  userId: string;
}

export const createAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.accessTokenSecret, { expiresIn: ACCESS_TOKEN_TTL });

export const createRefreshToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, config.refreshTokenSecret, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

export const createCsrfToken = (): string => crypto.randomUUID();

// Token opaco (no JWT) para flujos de un solo uso: verificación de email y
// recuperación de contraseña. Solo se guarda su hash en base de datos, nunca
// el valor en claro, así una fuga de la base de datos no permite reutilizarlo.
export const createRawToken = (): string =>
  crypto.randomBytes(32).toString("hex");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
