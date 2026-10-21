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

// El proveedor que respondió puede conocer el libro y no tener portada. Los
// demás se consultan solo para completarla; si fallan o tampoco la tienen, el
// libro se devuelve igual sin portada.
const findCoverElsewhere = async (
  providers: BookProvider[],
  isbn: string,
): Promise<Pick<ExternalBookDto, "coverUrl" | "coverSource">> => {
  for (const provider of providers) {
    try {
      const other = await provider.findByIsbn(isbn);

      if (other?.coverUrl && other.coverSource) {
        return { coverUrl: other.coverUrl, coverSource: other.coverSource };
      }
    } catch (error) {
      logger.warn(
        { provider: provider.name, reason: (error as Error).message },
        "Book provider failed while looking for a cover",
      );
    }
  }

  return {};
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
        const coverUrl = result.coverUrl
          ? {}
          : await findCoverElsewhere(
              providers.filter((provider) => provider !== answered),
              isbn,
            );

        return { ...result, ...coverUrl, isbn };
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
