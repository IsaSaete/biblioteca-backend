import { jest } from "@jest/globals";
import createOpenLibraryProvider from "../openLibraryProvider.js";
import { BookProviderError } from "../BookProvider.js";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ISBN = "9788437604947";

const edition = {
  title: "Cien años de soledad",
  authors: [{ name: "Gabriel García Márquez" }],
  publishers: [{ name: "Cátedra" }],
  publish_date: "March 2004",
  number_of_pages: 550,
  subjects: Array.from({ length: 8 }, (_, index) => ({
    name: `Tema ${index}`,
  })),
  cover: { medium: "http://covers.openlibrary.org/b/id/1-M.jpg" },
};

const fetchReturning = (response: Response | Error) =>
  jest.fn<typeof fetch>(async () => {
    if (response instanceof Error) {
      throw response;
    }

    return response;
  });

describe("Given the Open Library provider", () => {
  describe("When it looks up an ISBN that Open Library knows", () => {
    it("Then it should map the edition, cap categories at 5 and identify the app in the User-Agent", async () => {
      const fetchFn = fetchReturning(
        jsonResponse({ [`ISBN:${ISBN}`]: edition }),
      );
      const provider = createOpenLibraryProvider({ fetchFn });

      const book = await provider.findByIsbn(ISBN);

      expect(book).toEqual({
        isbn: ISBN,
        title: "Cien años de soledad",
        authors: ["Gabriel García Márquez"],
        publisher: "Cátedra",
        publishedYear: 2004,
        pageCount: 550,
        coverUrl: "https://covers.openlibrary.org/b/id/1-M.jpg",
        coverSource: "open_library",
        categories: ["Tema 0", "Tema 1", "Tema 2", "Tema 3", "Tema 4"],
      });
      const init = fetchFn.mock.calls[0][1] as RequestInit;
      expect(init.headers).toMatchObject({
        "User-Agent": expect.stringContaining("Glosa"),
      });
    });
  });

  describe("When the edition has no publisher", () => {
    it("Then it should omit the publisher", async () => {
      const { publishers: _publishers, ...withoutPublisher } = edition;
      const provider = createOpenLibraryProvider({
        fetchFn: fetchReturning(
          jsonResponse({ [`ISBN:${ISBN}`]: withoutPublisher }),
        ),
      });

      const book = await provider.findByIsbn(ISBN);

      expect(book).not.toHaveProperty("publisher");
    });
  });

  describe("When Open Library does not know the ISBN", () => {
    it("Then it should return null", async () => {
      const provider = createOpenLibraryProvider({
        fetchFn: fetchReturning(jsonResponse({})),
      });

      const book = await provider.findByIsbn(ISBN);

      expect(book).toBeNull();
    });
  });

  describe("When it searches by title", () => {
    it("Then it should return works with only title, authors and cover", async () => {
      const provider = createOpenLibraryProvider({
        fetchFn: fetchReturning(
          jsonResponse({
            docs: [
              {
                title: "La sombra del viento",
                author_name: ["Zafón"],
                cover_i: 42,
              },
              { title: "Sin portada" },
              { author_name: ["Sin título"] },
            ],
          }),
        ),
      });

      const books = await provider.search("sombra", 10);

      expect(books).toEqual([
        {
          title: "La sombra del viento",
          authors: ["Zafón"],
          coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg",
          coverSource: "open_library",
        },
        { title: "Sin portada", authors: [] },
      ]);
    });
  });

  describe("When Open Library fails", () => {
    it.each([
      ["answers 503", jsonResponse({}, 503)],
      ["returns an unexpected payload", jsonResponse(["no"])],
      ["returns an unreadable edition", jsonResponse({ [`ISBN:${ISBN}`]: {} })],
      ["is unreachable or times out", new Error("network")],
    ])(
      "Then it should throw BookProviderError when it %s",
      async (_case, response) => {
        const provider = createOpenLibraryProvider({
          fetchFn: fetchReturning(response),
        });

        const result = provider.findByIsbn(ISBN);

        await expect(result).rejects.toBeInstanceOf(BookProviderError);
      },
    );
  });
});
