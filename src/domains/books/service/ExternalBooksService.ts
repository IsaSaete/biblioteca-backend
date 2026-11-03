import BadGatewayError from "../../../shared/errors/BadGatewayError.js";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import logger from "../../../utils/logger.js";
import type { BookProvider } from "../provider/BookProvider.js";
import {
  validateIsbnQuery,
  validateSearchQuery,
} from "../validator/validateExternalBookQueries.js";
import type { ExternalBookDto } from "../types/types.js";

export const EXTERNAL_SEARCH_LIMIT = 10;

const providerUnavailable = (): BadGatewayError =>
  new BadGatewayError(
    "BOOK_PROVIDER_UNAVAILABLE",
    "Lo sentimos, no hemos podido encontrar este libro. Puedes añadirlo manualmente",
  );

// El proveedor que respondió puede conocer el libro y no traer algún dato:
// la portada, el autor, la editorial, el año o las páginas.
const hasMissingFields = (book: ExternalBookDto): boolean =>
  !book.coverUrl ||
  book.authors.length === 0 ||
  !book.publisher ||
  !book.publishedYear ||
  !book.pageCount;

// Rellena solo lo que falta en `book` con lo que trae `other`: nunca pisa un
// dato que ya estaba. La portada y su origen van siempre juntos.
const fillGaps = (
  book: ExternalBookDto,
  other: ExternalBookDto,
): ExternalBookDto => ({
  ...book,
  ...(!book.coverUrl &&
    other.coverUrl &&
    other.coverSource && {
      coverUrl: other.coverUrl,
      coverSource: other.coverSource,
    }),
  ...(book.authors.length === 0 &&
    other.authors.length > 0 && { authors: other.authors }),
  ...(!book.publisher && other.publisher && { publisher: other.publisher }),
  ...(!book.publishedYear &&
    other.publishedYear && { publishedYear: other.publishedYear }),
  ...(!book.pageCount && other.pageCount && { pageCount: other.pageCount }),
});

// Los demás proveedores se consultan solo para completar lo que falte, por
// orden y hasta que no falte nada; si fallan o tampoco lo tienen, el libro se
// devuelve igual con lo que haya.
const completeFromOtherProviders = async (
  book: ExternalBookDto,
  providers: BookProvider[],
  isbn: string,
): Promise<ExternalBookDto> => {
  let completed = book;

  for (const provider of providers) {
    if (!hasMissingFields(completed)) {
      break;
    }

    try {
      const other = await provider.findByIsbn(isbn);

      if (other) {
        completed = fillGaps(completed, other);
      }
    } catch (error) {
      logger.warn(
        { provider: provider.name, reason: (error as Error).message },
        "Book provider failed while completing missing fields",
      );
    }
  }

  return completed;
};

export interface ExternalBooksService {
  lookupByIsbn(query: unknown): Promise<ExternalBookDto>;
  searchExternal(query: unknown): Promise<ExternalBookDto[]>;
}

// Los proveedores se consultan por orden (el primero es el principal). Si uno
// falla se sigue con el siguiente; pero si algún proveedor falló y ninguno dio
// resultado, no se puede afirmar que el libro no exista: es un 502, no un 404.
const createExternalBooksService = (
  providers: BookProvider[],
): ExternalBooksService => {
  const queryProviders = async <T>(
    ask: (provider: BookProvider) => Promise<T>,
    hasResult: (result: T) => boolean,
    empty: T,
  ): Promise<{ result: T; anyFailed: boolean; answered?: BookProvider }> => {
    let anyFailed = false;

    for (const provider of providers) {
      try {
        const result = await ask(provider);

        if (hasResult(result)) {
          logger.info({ provider: provider.name }, "Book provider answered");

          return { result, anyFailed, answered: provider };
        }
      } catch (error) {
        anyFailed = true;
        logger.warn(
          { provider: provider.name, reason: (error as Error).message },
          "Book provider failed",
        );
      }
    }

    return { result: empty, anyFailed };
  };

  return {
    lookupByIsbn: async (query) => {
      const isbn = validateIsbnQuery(query);

      const { result, anyFailed, answered } = await queryProviders(
        (provider) => provider.findByIsbn(isbn),
        (book) => book !== null,
        null,
      );

      if (result) {
        const completed = await completeFromOtherProviders(
          result,
          providers.filter((provider) => provider !== answered),
          isbn,
        );

        return { ...completed, isbn };
      }

      if (anyFailed) {
        throw providerUnavailable();
      }

      throw new NotFoundError(
        "ISBN_NOT_FOUND",
        "No hemos encontrado ningún libro con ese ISBN",
      );
    },

    searchExternal: async (query) => {
      const text = validateSearchQuery(query);

      const { result, anyFailed } = await queryProviders(
        (provider) => provider.search(text, EXTERNAL_SEARCH_LIMIT),
        (books) => books.length > 0,
        [] as ExternalBookDto[],
      );

      if (result.length === 0 && anyFailed) {
        throw providerUnavailable();
      }

      return result.slice(0, EXTERNAL_SEARCH_LIMIT);
    },
  };
};

export default createExternalBooksService;
