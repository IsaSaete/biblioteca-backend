import { Router } from "express";
import config from "../../../config/index.js";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import BooksController from "../controller/BooksController.js";
import createExternalBooksController from "../controller/createExternalBooksController.js";
import limitExternalBookRequests from "../middleware/limitExternalBookRequests.js";
import createGoogleBooksProvider from "../provider/googleBooksProvider.js";
import createOpenLibraryProvider from "../provider/openLibraryProvider.js";
import createExternalBooksService, {
  type ExternalBooksService,
} from "../service/ExternalBooksService.js";

// El servicio externo se inyecta para poder sustituir los proveedores reales
// por falsos en los tests.
export const createBooksRouter = (
  externalBooksService: ExternalBooksService,
) => {
  const booksRouter = Router();
  const externalBooksController =
    createExternalBooksController(externalBooksService);

  booksRouter.use(authMiddleware);

  booksRouter.get(
    "/lookup-isbn",
    limitExternalBookRequests,
    externalBooksController.lookupIsbn,
  );
  booksRouter.get(
    "/search-external",
    limitExternalBookRequests,
    externalBooksController.searchExternal,
  );
  booksRouter.get("/", BooksController.listLibrary);
  // Antes de "/:id": si no, "tags" se leería como un id de libro.
  booksRouter.get("/tags", BooksController.listTags);
  booksRouter.get("/:id", BooksController.getBook);
  booksRouter.patch(
    "/:id/ejemplar",
    handleCsrf,
    BooksController.updateEjemplar,
  );
  booksRouter.delete("/:id", handleCsrf, BooksController.deleteBook);
  booksRouter.post("/", handleCsrf, BooksController.createBook);

  return booksRouter;
};

const booksRouter = createBooksRouter(
  createExternalBooksService([
    createGoogleBooksProvider({ apiKey: config.googleBooksApiKey }),
    createOpenLibraryProvider(),
  ]),
);

export default booksRouter;
