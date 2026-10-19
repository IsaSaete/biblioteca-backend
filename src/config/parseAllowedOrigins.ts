const toOrigin = (value: string): string => {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Origen no permitido: ${value}`);
  }

  return url.origin;
};

// Orígenes que pueden llamar a la API con credenciales: el del frontend más,
// opcionalmente, otros exactos separados por comas (p. ej. localhost en
// desarrollo). Nunca comodines: `new URL("*")` lanza, así que se rechazan.
export const parseAllowedOrigins = (
  frontendUrl: string,
  extraOrigins?: string,
): string[] => {
  const extras = (extraOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");

  return [...new Set([frontendUrl, ...extras].map(toOrigin))];
};
