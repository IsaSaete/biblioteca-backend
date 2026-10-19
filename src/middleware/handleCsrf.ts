import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import ForbiddenError from "../shared/errors/ForbiddenError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const areTokensEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return (
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(bufferA, bufferB)
  );
};

// Doble cookie (api-contract.md, sección Sesión): en peticiones que modifican
// datos, el header X-CSRF-Token debe coincidir con la cookie csrfToken. Una
// web ajena puede provocar que el navegador envíe la cookie, pero no puede
// leerla para copiarla al header.
const handleCsrf = (req: Request, _res: Response, next: NextFunction): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken: unknown = req.cookies?.csrfToken;
  const headerToken = req.get("X-CSRF-Token");

  if (
    typeof cookieToken !== "string" ||
    cookieToken.length === 0 ||
    !headerToken ||
    !areTokensEqual(cookieToken, headerToken)
  ) {
    next(new ForbiddenError("CSRF_INVALID", "Petición no autorizada"));
    return;
  }

  next();
};

export default handleCsrf;
