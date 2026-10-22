import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import QuotesController from "../controller/QuotesController.js";

const quotesRouter = Router();

quotesRouter.use(authMiddleware);

quotesRouter.get("/", QuotesController.listQuotes);
quotesRouter.post("/", handleCsrf, QuotesController.createQuote);
// Antes de "/:id": si no, "books" se leería como un id de cita.
quotesRouter.get("/books", QuotesController.listQuoteBooks);
quotesRouter.get("/:id", QuotesController.getQuote);
quotesRouter.patch("/:id", handleCsrf, QuotesController.updateQuote);
quotesRouter.delete("/:id", handleCsrf, QuotesController.deleteQuote);

export default quotesRouter;
