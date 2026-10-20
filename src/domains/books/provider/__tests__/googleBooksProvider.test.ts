import { jest } from "@jest/globals";
import createGoogleBooksProvider from "../googleBooksProvider.js";
import { BookProviderError } from "../BookProvider.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const volume = {
  volumeInfo: {
    title: "La sombra del viento",
    authors: ["Carlos Ruiz Zafón"],
    publisher: "Planeta",
    publishedDate: "2001-04-12",
    description: "Barcelona, 1945.",
    industryIdentifiers: [
      { type: "ISBN_10", identifier: "0306406152" },
      { type: "ISBN_13", identifier: "9780306406157" },
    ],
    pageCount: 576,
    categories: ["Fiction"],
    imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
    language: "es",
  },
};

const fetchReturning = (response: Response | Error) =>
  jest.fn<typeof fetch>(async () => {
    if (response instanceof Error) {
      throw response;
    }

    return response;
  });

describe("Given the Google Books provider", () => {
  describe("When it looks up an ISBN that Google knows", () => {
    it("Then it should map the volume omitting what Google does not give and serving the cover over https", async () => {
      const fetchFn = fetchReturning(jsonResponse({ items: [volume] }));
      const provider = createGoogleBooksProvider({ fetchFn });

      const book = await provider.findByIsbn("9780306406157");

      expect(book).toEqual({
        isbn: "9780306406157",
        title: "La sombra del viento",
        authors: ["Carlos Ruiz Zafón"],
        publisher: "Planeta",
        publishedYear: 2001,
        pageCount: 576,
        language: "es",
        coverUrl: "https://books.google.com/cover.jpg",
        coverSource: "google_books",
        synopsis: "Barcelona, 1945.",
        categories: ["Fiction"],
      });
    });

    it("Then it should query by isbn and send the API key only when configured", async () => {
      const fetchFn = fetchReturning(jsonResponse({ items: [volume] }));
      const provider = createGoogleBooksProvider({ fetchFn, apiKey: "k-123" });

      await provider.findByIsbn("9780306406157");

      const url = fetchFn.mock.calls[0][0] as URL;
      expect(url.searchParams.get("q")).toBe("isbn:9780306406157");
      expect(url.searchParams.get("key")).toBe("k-123");
    });
  });

  describe("When Google has no volume for the ISBN", () => {
    it("Then it should return null", async () => {
      const provider = createGoogleBooksProvider({
        fetchFn: fetchReturning(jsonResponse({ totalItems: 0 })),
      });

      const book = await provider.findByIsbn("9780306406157");

      expect(book).toBeNull();
    });
  });

  describe("When the volume gives almost no data", () => {
    it("Then it should return only the title and an empty authors list", async () => {
      const provider = createGoogleBooksProvider({
        fetchFn: fetchReturning(
          jsonResponse({ items: [{ volumeInfo: { title: "Solo título" } }] }),
        ),
      });

      const book = await provider.findByIsbn("9780306406157");

      expect(book).toEqual({ title: "Solo título", authors: [] });
    });
  });

  describe("When a search returns a malformed volume among valid ones", () => {
    it("Then it should skip the malformed one", async () => {
      const provider = createGoogleBooksProvider({
        fetchFn: fetchReturning(
          jsonResponse({ items: [{ volumeInfo: {} }, volume] }),
        ),
      });

      const books = await provider.search("sombra", 10);

      expect(books).toHaveLength(1);
    });
  });

  describe("When Google fails", () => {
    it.each([
      ["answers 429 (quota)", jsonResponse({ error: {} }, 429)],
      ["answers 500", jsonResponse({}, 500)],
      ["returns an unexpected payload", jsonResponse({ items: "no" })],
      ["is unreachable or times out", new Error("network")],
    ])(
      "Then it should throw BookProviderError when it %s",
      async (_case, response) => {
        const provider = createGoogleBooksProvider({
          fetchFn: fetchReturning(response),
          apiKey: "secret-key",
        });

        const result = provider.findByIsbn("9780306406157");

        await expect(result).rejects.toBeInstanceOf(BookProviderError);
        await expect(result).rejects.not.toThrow(/secret-key/);
      },
    );
  });
});
