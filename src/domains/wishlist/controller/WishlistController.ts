import type { NextFunction, Request, Response } from "express";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import WishlistService from "../service/WishlistService.js";

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

const addToWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const item = await WishlistService.addToWishlist(
      getSessionUserId(req),
      req.body,
    );

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
};

const WishlistController = { addToWishlist };

export default WishlistController;
