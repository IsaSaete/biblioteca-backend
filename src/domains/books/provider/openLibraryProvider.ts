import { z } from "zod";
import { BookProviderError, type BookProvider } from "./BookProvider.js";
import requestJson, { DEFAULT_PROVIDER_TIMEOUT_MS } from "./requestJson.js";
import type { ExternalBookDto } from "../types/types.js";

const PROVIDER_NAME = "open_library";
const OPEN_LIBRARY_URL = "https://openlibrary.org";
// Open Library pide identificar la aplicación en el User-Agent.
const USER_AGENT = "Glosa (biblioteca-backend)";
const MAX_CATEGORIES = 5;

// Datos de una edición concreta (el endpoint «legacy» de Books, único que da
// editorial, páginas y autores de la edición en una sola petición).
const editionSchema = z.object({
  title: z.string().trim().min(1),
  authors: z.array(z.object({ name: z.string() })).optional(),
  publishers: z.array(z.object({ name: z.string() })).optional(),
  publish_date: z.string().optional(),
  number_of_pages: z.number().optional(),
  subjects: z.array(z.object({ name: z.string() })).optional(),
  cover: z.object({ medium: z.string().optional() }).optional(),
});

// La búsqueda devuelve obras, no ediciones: sin editorial, año ni páginas, que
// serían los de otra edición.
const searchSchema = z.object({
  docs: z.array(z.unknown()).default([]),
});

const workSchema = z.object({
  title: z.string().trim().min(1),
  author_name: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
});

const coverFromId = (coverId: number): string =>
  `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;

const mapEdition = (isbn: string, data: unknown): ExternalBookDto => {
  const parsed = editionSchema.safeParse(data);

  if (!parsed.success) {
    throw new BookProviderError(PROVIDER_NAME, "respuesta no válida");
  }

  const edition = parsed.data;
  const publisher = edition.publishers?.[0]?.name;
  const year = edition.publish_date?.match(/\d{4}/)?.[0];
  const coverUrl = edition.cover?.medium?.replace(/^http:\/\//, "https://");
  const categories = edition.subjects
    ?.map((subject) => subject.name)
    .slice(0, MAX_CATEGORIES);

  return {
    isbn,
    title: edition.title,
    authors: edition.authors?.map((author) => author.name) ?? [],
    ...(publisher && { publisher }),
    ...(year && { publishedYear: Number(year) }),
    ...(edition.number_of_pages &&
      edition.number_of_pages > 0 && { pageCount: edition.number_of_pages }),
    ...(coverUrl && { coverUrl, coverSource: "open_library" as const }),
    ...(categories?.length && { categories }),
  };
};

export interface OpenLibraryProviderOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const createOpenLibraryProvider = ({
  fetchFn = fetch,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
}: OpenLibraryProviderOptions = {}): BookProvider => {
  const request = (url: URL) =>
    requestJson({
      provider: PROVIDER_NAME,
      url,
      fetchFn,
      timeoutMs,
      headers: { "User-Agent": USER_AGENT },
    });

  return {
    name: PROVIDER_NAME,

    findByIsbn: async (isbn) => {
      const url = new URL(`${OPEN_LIBRARY_URL}/api/books`);
      url.searchParams.set("bibkeys", `ISBN:${isbn}`);
      url.searchParams.set("format", "json");
      url.searchParams.set("jscmd", "data");

      const body = await request(url);

      if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new BookProviderError(PROVIDER_NAME, "respuesta no válida");
      }

      const edition = (body as Record<string, unknown>)[`ISBN:${isbn}`];

      return edition === undefined ? null : mapEdition(isbn, edition);
    },

    search: async (query, limit) => {
      const url = new URL(`${OPEN_LIBRARY_URL}/search.json`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("fields", "title,author_name,cover_i");

      const body = searchSchema.safeParse(await request(url));

      if (!body.success) {
        throw new BookProviderError(PROVIDER_NAME, "respuesta no válida");
      }

      return body.data.docs.flatMap((doc): ExternalBookDto[] => {
        const work = workSchema.safeParse(doc);

        if (!work.success) {
          return [];
        }

        return [
          {
            title: work.data.title,
            authors: work.data.author_name ?? [],
            ...(work.data.cover_i && {
              coverUrl: coverFromId(work.data.cover_i),
              coverSource: "open_library" as const,
            }),
          },
        ];
      });
    },
  };
};

export default createOpenLibraryProvider;
