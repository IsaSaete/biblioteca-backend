import type { NextFunction, Request, Response } from "express";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import BooksService from "../service/BooksService.js";

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

const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { book, ejemplar } = await BooksService.createBook(
      getSessionUserId(req),
      req.body,
    );

    res.status(201).json({ book, ejemplar });
  } catch (error) {
    next(error);
  }
};

const listLibrary = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = await BooksService.listLibrary(
      getSessionUserId(req),
      req.query,
    );

    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
};

const getBook = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { book, ejemplar } = await BooksService.getBook(
      getSessionUserId(req),
      req.params.id,
    );

    res.status(200).json({ book, ejemplar });
  } catch (error) {
    next(error);
  }
};

const updateEjemplar = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ejemplar = await BooksService.updateEjemplar(
      getSessionUserId(req),
      req.params.id,
      req.body,
    );

    res.status(200).json({ ejemplar });
  } catch (error) {
    next(error);
  }
};

const BooksController = { createBook, listLibrary, getBook, updateEjemplar };

export default BooksController;
