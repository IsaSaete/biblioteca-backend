import type { NextFunction, Request, Response } from "express";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import QuotesService from "../service/QuotesService.js";

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

const createQuote = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const quote = await QuotesService.createQuote(
      getSessionUserId(req),
      req.body,
    );

    res.status(201).json({ quote });
  } catch (error) {
    next(error);
  }
};

const listQuotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = await QuotesService.listQuotes(
      getSessionUserId(req),
      req.query,
    );

    res.status(200).json(page);
  } catch (error) {
    next(error);
  }
};

const getQuote = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const quote = await QuotesService.getQuote(
      getSessionUserId(req),
      req.params.id,
    );

    res.status(200).json({ quote });
  } catch (error) {
    next(error);
  }
};

const updateQuote = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const quote = await QuotesService.updateQuote(
      getSessionUserId(req),
      req.params.id,
      req.body,
    );

    res.status(200).json({ quote });
  } catch (error) {
    next(error);
  }
};

const deleteQuote = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await QuotesService.deleteQuote(getSessionUserId(req), req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const listQuoteBooks = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const quoteBooks = await QuotesService.listQuoteBooks(
      getSessionUserId(req),
    );

    res.status(200).json(quoteBooks);
  } catch (error) {
    next(error);
  }
};

const QuotesController = {
  createQuote,
  listQuotes,
  getQuote,
  updateQuote,
  deleteQuote,
  listQuoteBooks,
};

export default QuotesController;
