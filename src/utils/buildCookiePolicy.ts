export type CookieSameSite = "none" | "lax" | "strict";

export interface CookiePolicy {
  sameSite: CookieSameSite;
  refreshTokenPath: string;
}

interface CookiePolicyInput {
  sameSite: CookieSameSite;
  // Prefijo bajo el que el navegador ve la API cuando va detrás de un proxy del
  // frontend (p. ej. "/api"). La cookie del refresh token se limita a la ruta
  // de refresh tal y como la ve el navegador, no tal y como la ve el backend.
  publicPathPrefix: string;
}

const REFRESH_ENDPOINT_PATH = "/auth/refresh";

export const buildCookiePolicy = ({
  sameSite,
  publicPathPrefix,
}: CookiePolicyInput): CookiePolicy => ({
  sameSite,
  refreshTokenPath: `${publicPathPrefix}${REFRESH_ENDPOINT_PATH}`,
});
