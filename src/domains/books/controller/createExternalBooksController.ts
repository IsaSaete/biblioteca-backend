import type { NextFunction, Request, Response } from "express";
import type { ExternalBooksService } from "../service/ExternalBooksService.js";

const createExternalBooksController = (service: ExternalBooksService) => ({
  lookupIsbn: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const book = await service.lookupByIsbn(req.query);

      res.status(200).json({ book });
    } catch (error) {
      next(error);
    }
  },

  searchExternal: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const books = await service.searchExternal(req.query);

      res.status(200).json({ results: books.map((book) => ({ book })) });
    } catch (error) {
      next(error);
    }
  },
});

export default createExternalBooksController;
