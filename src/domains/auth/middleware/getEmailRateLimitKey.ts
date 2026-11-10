import type { Request } from "express";

// El email del body, sin espacios ni mayúsculas, para que «Isa@x.com» e
// «isa@x.com » cuenten como la misma cuenta. Vacío si no viene (la validación
// ya lo rechazará: no merece gastar el límite de nadie).
const getEmailRateLimitKey = (req: Request): string => {
  const email: unknown = req.body?.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

export default getEmailRateLimitKey;
