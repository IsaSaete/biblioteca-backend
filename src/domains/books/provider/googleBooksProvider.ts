import { z } from "zod";
import toIsbn13 from "../utils/toIsbn13.js";
import { BookProviderError, type BookProvider } from "./BookProvider.js";
import requestJson, { DEFAULT_PROVIDER_TIMEOUT_MS } from "./requestJson.js";
import type { ExternalBookDto } from "../types/types.js";

const PROVIDER_NAME = "google_books";
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

const volumeSchema = z.object({
  volumeInfo: z.object({
    title: z.string().trim().min(1),
    authors: z.array(z.string()).optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    description: z.string().optional(),
    industryIdentifiers: z
      .array(z.object({ type: z.string(), identifier: z.string() }))
      .optional(),
    pageCount: z.number().optional(),
    categories: z.array(z.string()).optional(),
    imageLinks: z
      .object({
        thumbnail: z.string().optional(),
        smallThumbnail: z.string().optional(),
      })
      .optional(),
    language: z.string().optional(),
  }),
});

const responseSchema = z.object({ items: z.array(z.unknown()).optional() });

const extractIsbn = (
  identifiers: { type: string; identifier: string }[] = [],
): string | undefined => {
  for (const type of ["ISBN_13", "ISBN_10"]) {
    const found = identifiers.find((item) => item.type === type);
    const isbn = found ? toIsbn13(found.identifier) : null;

    if (isbn) {
      return isbn;
    }
  }

  return undefined;
};

const mapVolume = (item: unknown): ExternalBookDto | undefined => {
  const parsed = volumeSchema.safeParse(item);

  if (!parsed.success) {
    return undefined;
  }

  const info = parsed.data.volumeInfo;
  const isbn = extractIsbn(info.industryIdentifiers);
  const year = info.publishedDate?.match(/^\d{4}/)?.[0];
  // Google devuelve las miniaturas en http: se sirven por https.
  const coverUrl = (
    info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  )?.replace(/^http:\/\//, "https://");

  return {
    ...(isbn && { isbn }),
    title: info.title,
    authors: info.authors ?? [],
    ...(info.publisher && { publisher: info.publisher }),
    ...(year && { publishedYear: Number(year) }),
    ...(info.pageCount && info.pageCount > 0 && { pageCount: info.pageCount }),
    ...(info.language && { language: info.language }),
    ...(coverUrl && { coverUrl, coverSource: "google_books" as const }),
    ...(info.description && { synopsis: info.description }),
    ...(info.categories?.length && { categories: info.categories }),
  };
};

export interface GoogleBooksProviderOptions {
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const createGoogleBooksProvider = ({
  apiKey,
  fetchFn = fetch,
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
}: GoogleBooksProviderOptions = {}): BookProvider => {
  const searchVolumes = async (
    query: string,
    limit: number,
  ): Promise<ExternalBookDto[]> => {
    const url = new URL(GOOGLE_BOOKS_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("printType", "books");

    if (apiKey) {
      url.searchParams.set("key", apiKey);
    }

    const body = responseSchema.safeParse(
      await requestJson({ provider: PROVIDER_NAME, url, fetchFn, timeoutMs }),
    );

    if (!body.success) {
      throw new BookProviderError(PROVIDER_NAME, "respuesta no válida");
    }

    return (body.data.items ?? []).flatMap((item) => mapVolume(item) ?? []);
  };

  return {
    name: PROVIDER_NAME,
    findByIsbn: async (isbn) =>
      (await searchVolumes(`isbn:${isbn}`, 1))[0] ?? null,
    search: searchVolumes,
  };
};

export default createGoogleBooksProvider;
