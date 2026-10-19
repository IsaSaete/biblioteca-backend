import type { CookieOptions, Response } from "express";
import { createCsrfToken } from "./tokens.js";
import type { SessionTokens } from "../domains/auth/types/types.js";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_PATH = "/auth/refresh";

const baseCookieOptions: CookieOptions = {
  secure: true,
  sameSite: "none",
};

interface SetSessionCookiesOptions {
  // /auth/refresh no rota el csrfToken: peticiones en vuelo con el header
  // anterior fallarían justo después de refrescar.
  rotateCsrfToken?: boolean;
}

// Emite las cookies de sesión descritas en api-contract.md (sección
// "Sesión"): accessToken y refreshToken httpOnly, csrfToken legible por el
// frontend. Los tokens JWT los crea el service (que también guarda el hash del
// refreshToken); aquí solo se convierten en cookies.
export const setSessionCookies = (
  res: Response,
  session: SessionTokens,
  { rotateCsrfToken = true }: SetSessionCookiesOptions = {},
): void => {
  res.cookie("accessToken", session.accessToken, {
    ...baseCookieOptions,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie("refreshToken", session.refreshToken, {
    ...baseCookieOptions,
    httpOnly: true,
    path: REFRESH_TOKEN_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });

  if (rotateCsrfToken) {
    res.cookie("csrfToken", createCsrfToken(), {
      ...baseCookieOptions,
      httpOnly: false,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }
};

// Para borrar una cookie el navegador exige los mismos atributos (path,
// secure, sameSite) con los que se creó, sobre todo el path del refreshToken.
export const clearSessionCookies = (res: Response): void => {
  res.clearCookie("accessToken", { ...baseCookieOptions, httpOnly: true });
  res.clearCookie("refreshToken", {
    ...baseCookieOptions,
    httpOnly: true,
    path: REFRESH_TOKEN_PATH,
  });
  res.clearCookie("csrfToken", { ...baseCookieOptions, httpOnly: false });
};
