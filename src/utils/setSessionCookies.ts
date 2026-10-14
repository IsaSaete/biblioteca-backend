import type { Response } from "express";
import {
  createAccessToken,
  createCsrfToken,
  createRefreshToken,
} from "./tokens.js";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionCookiesPayload {
  userId: string;
}

// Emite las tres cookies de sesión descritas en api-contract.md (sección
// "Sesión"): accessToken y refreshToken httpOnly, csrfToken legible por el
// frontend. Devuelve el refreshToken para que quien llame pueda guardar su
// hash en el usuario.
const setSessionCookies = (
  res: Response,
  payload: SessionCookiesPayload,
): { refreshToken: string } => {
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);
  const csrfToken = createCsrfToken();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/auth/refresh",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });

  res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });

  return { refreshToken };
};

export default setSessionCookies;
