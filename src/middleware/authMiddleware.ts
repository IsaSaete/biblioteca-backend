import type { NextFunction, Request, Response } from "express";
import UnauthorizedError from "../shared/errors/UnauthorizedError.js";
import { verifyAccessToken } from "../utils/tokens.js";

const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const accessToken: unknown = req.cookies?.accessToken;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    next(
      new UnauthorizedError(
        "AUTH_UNAUTHENTICATED",
        "Necesitas iniciar sesión para acceder a este recurso",
      ),
    );
    return;
  }

  try {
    req.userId = verifyAccessToken(accessToken).userId;
    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
