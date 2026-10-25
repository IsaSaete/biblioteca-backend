import type { NextFunction, Request, Response } from "express";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import StatsService from "../service/StatsService.js";

// authMiddleware garantiza userId; la comprobación estrecha el tipo.
const getSessionUserId = (req: Request): string => {
  if (!req.userId) {
    throw new UnauthorizedError(
      "AUTH_UNAUTHENTICATED",
      "Necesitas iniciar sesión para acceder a este recurso",
    );
  }

  return req.userId;
};

const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stats = await StatsService.getStats(getSessionUserId(req));

    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

const StatsController = { getStats };

export default StatsController;
