import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import BooksController from "../controller/BooksController.js";

const booksRouter = Router();

booksRouter.use(authMiddleware);

booksRouter.get("/", BooksController.listLibrary);
booksRouter.post("/", handleCsrf, BooksController.createBook);

export default booksRouter;
