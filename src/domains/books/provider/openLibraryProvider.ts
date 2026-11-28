import { z } from "zod";
import toIsbn13 from "../utils/toIsbn13.js";
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

// La búsqueda devuelve obras y, dentro de cada una, las ediciones que encajan
// con lo escrito. Cada edición es un resultado propio, con su ISBN, editorial,
// año y portada reales, para que el usuario elija la suya. Una obra sin
// ediciones (o sin ISBN válido en ellas) se devuelve solo con título y autores.
const searchSchema = z.object({
  docs: z.array(z.unknown()).default([]),
});

const searchEditionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  author_name: z.array(z.string()).optional(),
  publisher: z.array(z.string()).optional(),
  publish_year: z.array(z.number()).optional(),
  isbn: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
});

const workSchema = z.object({
  title: z.string().trim().min(1),
  author_name: z.array(z.string()).optional(),
  cover_i: z.number().optional(),
  editions: z.object({ docs: z.array(z.unknown()).default([]) }).optional(),
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

const firstIsbn13 = (isbns: string[] = []): string | undefined =>
  isbns.map(toIsbn13).find((isbn): isbn is string => isbn !== null);

const mapEditionResult = (
  work: z.infer<typeof workSchema>,
  doc: unknown,
): ExternalBookDto[] => {
  const edition = searchEditionSchema.safeParse(doc);
  const isbn = edition.success ? firstIsbn13(edition.data.isbn) : undefined;

  if (!edition.success || !isbn) {
    return [];
  }

  const { title, author_name, publisher, publish_year, cover_i } = edition.data;
  const authors = author_name ?? work.author_name ?? [];

  return [
    {
      isbn,
      title: title ?? work.title,
      authors,
      ...(publisher?.[0] && { publisher: publisher[0] }),
      ...(publish_year?.[0] && { publishedYear: publish_year[0] }),
      ...(cover_i && {
        coverUrl: coverFromId(cover_i),
        coverSource: "open_library" as const,
      }),
    },
  ];
};

const mapWork = (doc: unknown): ExternalBookDto[] => {
  const work = workSchema.safeParse(doc);

  if (!work.success) {
    return [];
  }

  const editions = (work.data.editions?.docs ?? []).flatMap((edition) =>
    mapEditionResult(work.data, edition),
  );

  if (editions.length > 0) {
    return editions;
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
      // Sin `key` Open Library no devuelve las ediciones (`editions`), aunque se
      // pidan.
      url.searchParams.set(
        "fields",
        "key,title,author_name,cover_i,editions,editions.title,editions.author_name,editions.publisher,editions.publish_year,editions.isbn,editions.cover_i",
      );

      const body = searchSchema.safeParse(await request(url));

      if (!body.success) {
        throw new BookProviderError(PROVIDER_NAME, "respuesta no válida");
      }

      return body.data.docs.flatMap(mapWork);
    },
  };
};

export default createOpenLibraryProvider;
