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

const listWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = await WishlistService.listWishlist(
      getSessionUserId(req),
      req.query,
    );

    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
};

const updateWishlistItem = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const item = await WishlistService.updateWishlistItem(
      getSessionUserId(req),
      req.params.id,
      req.body,
    );

    res.status(200).json({ item });
  } catch (error) {
    next(error);
  }
};

const removeFromWishlist = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await WishlistService.removeFromWishlist(
      getSessionUserId(req),
      req.params.id,
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const WishlistController = {
  addToWishlist,
  listWishlist,
  updateWishlistItem,
  removeFromWishlist,
};

export default WishlistController;
