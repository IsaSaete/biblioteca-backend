import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import QuotesController from "../controller/QuotesController.js";

const quotesRouter = Router();

quotesRouter.use(authMiddleware);

quotesRouter.get("/", QuotesController.listQuotes);
quotesRouter.post("/", handleCsrf, QuotesController.createQuote);

export default quotesRouter;
