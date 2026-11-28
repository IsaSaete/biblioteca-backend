import BadGatewayError from "../../../shared/errors/BadGatewayError.js";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import logger from "../../../utils/logger.js";
import type { BookProvider } from "../provider/BookProvider.js";
import {
  validateIsbnQuery,
  validateSearchQuery,
} from "../validator/validateExternalBookQueries.js";
import type { ExternalBookDto } from "../types/types.js";
import selectGenre from "../utils/selectGenre.js";
import synopsisLanguageMatch from "../utils/synopsisLanguage.js";

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

// Las categorías de los proveedores (en varios idiomas y con mucho ruido) se
// reducen a un único género del catálogo. Si ninguna es un género, no hay
// categorías; lo descartado se registra para ampliar el diccionario.
const withNormalizedGenre = (book: ExternalBookDto): ExternalBookDto => {
  const { categories, ...rest } = book;

  if (!categories?.length) {
    return book;
  }

  const { genre, unmapped } = selectGenre(categories);

  if (unmapped.length > 0) {
    logger.info({ unmapped }, "Book categories not recognised as a genre");
  }

  return { ...rest, ...(genre && { categories: [genre] }) };
};

const withoutSynopsis = (book: ExternalBookDto): ExternalBookDto => {
  const { synopsis, ...rest } = book;

  return synopsis === undefined ? book : rest;
};

// Si la sinopsis no está en el idioma del libro se descarta: mejor sin sinopsis
// que con una que no se entiende.
const withSynopsisInBookLanguage = (book: ExternalBookDto): ExternalBookDto =>
  book.synopsis &&
  synopsisLanguageMatch(book.synopsis, book.language) === "mismatch"
    ? withoutSynopsis(book)
    : book;

const sameTitle = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// Busca la sinopsis en el idioma del libro entre otras ediciones del mismo
// título y autor/a. Solo se acepta una confirmada en ese idioma; si ningún
// proveedor la tiene o fallan, el libro se queda sin sinopsis.
const findSynopsisInBookLanguage = async (
  book: ExternalBookDto,
  providers: BookProvider[],
): Promise<string | undefined> => {
  if (!book.language) {
    return undefined;
  }

  const query = [book.title, book.authors[0]].filter(Boolean).join(" ");

  for (const provider of providers) {
    try {
      const results = await provider.search(query, EXTERNAL_SEARCH_LIMIT, {
        language: book.language,
      });
      const found = results.find(
        (result) =>
          result.synopsis &&
          sameTitle(result.title, book.title) &&
          synopsisLanguageMatch(result.synopsis, book.language) === "match",
      );

      if (found?.synopsis) {
        return found.synopsis;
      }
    } catch (error) {
      logger.warn(
        { provider: provider.name, reason: (error as Error).message },
        "Book provider failed while looking for a synopsis",
      );
    }
  }

  return undefined;
};

const replaceSynopsisInOtherLanguage = async (
  book: ExternalBookDto,
  providers: BookProvider[],
): Promise<ExternalBookDto> => {
  const checked = withSynopsisInBookLanguage(book);

  if (checked === book) {
    return book;
  }

  const synopsis = await findSynopsisInBookLanguage(book, providers);

  return synopsis ? { ...checked, synopsis } : checked;
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

        const inBookLanguage = await replaceSynopsisInOtherLanguage(
          completed,
          providers,
        );

        return { ...withNormalizedGenre(inBookLanguage), isbn };
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

      return result
        .slice(0, EXTERNAL_SEARCH_LIMIT)
        .map(withSynopsisInBookLanguage)
        .map(withNormalizedGenre);
    },
  };
};

export default createExternalBooksService;
