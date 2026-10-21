import { jest } from "@jest/globals";
import createExternalBooksService from "../ExternalBooksService.js";
import {
  ISBN_10_OF_ISBN_13,
  ISBN_13,
  buildExternalBook,
  buildFakeProvider,
} from "../../fixtures/books.fixtures.js";

const googleBook = buildExternalBook();
const openLibraryBook = buildExternalBook({
  publisher: undefined,
  coverSource: "open_library",
});

describe("Given the ExternalBooksService.lookupByIsbn function", () => {
  describe("When the main provider knows the ISBN", () => {
    it("Then it should return its book and not ask the fallback", async () => {
      const fallback = buildFakeProvider("open_library", {
        book: openLibraryBook,
      });
      const findByIsbn = jest.spyOn(fallback, "findByIsbn");
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { book: googleBook }),
        fallback,
      ]);

      const book = await service.lookupByIsbn({ isbn: ISBN_13 });

      expect(book).toEqual(googleBook);
      expect(findByIsbn).not.toHaveBeenCalled();
    });
  });

  describe("When the main provider knows the book but has no cover and the fallback has one", () => {
    it("Then it should return the main book with the fallback's cover", async () => {
      const withoutCover = buildExternalBook({
        coverUrl: undefined,
        coverSource: undefined,
      });
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { book: withoutCover }),
        buildFakeProvider("open_library", { book: openLibraryBook }),
      ]);

      const book = await service.lookupByIsbn({ isbn: ISBN_13 });

      expect(book).toEqual({
        ...withoutCover,
        coverUrl: openLibraryBook.coverUrl,
        coverSource: "open_library",
      });
    });
  });

  describe("When the main provider has no cover and the fallback fails", () => {
    it("Then it should still return the main book without cover", async () => {
      const withoutCover = buildExternalBook({
        coverUrl: undefined,
        coverSource: undefined,
      });
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { book: withoutCover }),
        buildFakeProvider("open_library", { failing: true }),
      ]);

      const book = await service.lookupByIsbn({ isbn: ISBN_13 });

      expect(book).toEqual(withoutCover);
    });
  });

  describe("When the main provider does not know the ISBN but the fallback does", () => {
    it("Then it should return the fallback's book", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { book: null }),
        buildFakeProvider("open_library", { book: openLibraryBook }),
      ]);

      const book = await service.lookupByIsbn({ isbn: ISBN_13 });

      expect(book).toEqual(openLibraryBook);
    });
  });

  describe("When the main provider fails but the fallback knows the ISBN", () => {
    it("Then it should return the fallback's book", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { failing: true }),
        buildFakeProvider("open_library", { book: openLibraryBook }),
      ]);

      const book = await service.lookupByIsbn({ isbn: ISBN_13 });

      expect(book).toEqual(openLibraryBook);
    });
  });

  describe("When no provider knows the ISBN", () => {
    it("Then it should fail with ISBN_NOT_FOUND (404)", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { book: null }),
        buildFakeProvider("open_library", { book: null }),
      ]);

      const result = service.lookupByIsbn({ isbn: ISBN_13 });

      await expect(result).rejects.toMatchObject({
        code: "ISBN_NOT_FOUND",
        httpStatus: 404,
      });
    });
  });

  describe("When one provider fails and the other does not find the book", () => {
    it.each([
      ["the main fails", true, false],
      ["the fallback fails", false, true],
    ])(
      "Then it should fail with BOOK_PROVIDER_UNAVAILABLE (502), not 404, when %s",
      async (_case, mainFails, fallbackFails) => {
        const service = createExternalBooksService([
          buildFakeProvider("google_books", {
            book: null,
            failing: mainFails,
          }),
          buildFakeProvider("open_library", {
            book: null,
            failing: fallbackFails,
          }),
        ]);

        const result = service.lookupByIsbn({ isbn: ISBN_13 });

        await expect(result).rejects.toMatchObject({
          code: "BOOK_PROVIDER_UNAVAILABLE",
          httpStatus: 502,
        });
      },
    );
  });

  describe("When every provider fails", () => {
    it("Then it should fail with BOOK_PROVIDER_UNAVAILABLE (502)", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { failing: true }),
        buildFakeProvider("open_library", { failing: true }),
      ]);

      const result = service.lookupByIsbn({ isbn: ISBN_13 });

      await expect(result).rejects.toMatchObject({
        code: "BOOK_PROVIDER_UNAVAILABLE",
      });
    });
  });

  describe("When the ISBN is invalid", () => {
    it.each([{}, { isbn: "123" }, { isbn: "9780306406158" }])(
      "Then it should fail with INVALID_ISBN before asking any provider (%j)",
      async (query) => {
        const provider = buildFakeProvider("google_books", {
          book: googleBook,
        });
        const findByIsbn = jest.spyOn(provider, "findByIsbn");
        const service = createExternalBooksService([provider]);

        const result = service.lookupByIsbn(query);

        await expect(result).rejects.toMatchObject({
          code: "INVALID_ISBN",
          field: "isbn",
          httpStatus: 400,
        });
        expect(findByIsbn).not.toHaveBeenCalled();
      },
    );
  });

  describe("When the ISBN is sent as an ISBN-10 with hyphens", () => {
    it("Then it should look it up and answer with the normalized ISBN-13", async () => {
      const provider = buildFakeProvider("google_books", {
        book: buildExternalBook({ isbn: undefined }),
      });
      const findByIsbn = jest.spyOn(provider, "findByIsbn");
      const service = createExternalBooksService([provider]);

      const book = await service.lookupByIsbn({ isbn: "0-306-40615-2" });

      expect(ISBN_10_OF_ISBN_13).not.toBe(ISBN_13);
      expect(findByIsbn).toHaveBeenCalledWith(ISBN_13);
      expect(book.isbn).toBe(ISBN_13);
    });
  });
});

describe("Given the ExternalBooksService.searchExternal function", () => {
  describe("When the main provider returns more than 10 results", () => {
    it("Then it should return at most 10", async () => {
      const results = Array.from({ length: 15 }, (_, index) =>
        buildExternalBook({ title: `Libro ${index}` }),
      );
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { results }),
      ]);

      const books = await service.searchExternal({ q: "libro" });

      expect(books).toHaveLength(10);
    });
  });

  describe("When the main provider has no results but the fallback does", () => {
    it("Then it should return the fallback's results", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { results: [] }),
        buildFakeProvider("open_library", { results: [openLibraryBook] }),
      ]);

      const books = await service.searchExternal({ q: "sombra" });

      expect(books).toEqual([openLibraryBook]);
    });
  });

  describe("When the main provider fails but the fallback has results", () => {
    it("Then it should return the fallback's results", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { failing: true }),
        buildFakeProvider("open_library", { results: [openLibraryBook] }),
      ]);

      const books = await service.searchExternal({ q: "sombra" });

      expect(books).toEqual([openLibraryBook]);
    });
  });

  describe("When no provider finds anything and none fails", () => {
    it("Then it should return an empty list", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books"),
        buildFakeProvider("open_library"),
      ]);

      const books = await service.searchExternal({ q: "zzzz" });

      expect(books).toEqual([]);
    });
  });

  describe("When one provider fails and the other finds nothing", () => {
    it("Then it should fail with BOOK_PROVIDER_UNAVAILABLE", async () => {
      const service = createExternalBooksService([
        buildFakeProvider("google_books", { failing: true }),
        buildFakeProvider("open_library"),
      ]);

      const result = service.searchExternal({ q: "sombra" });

      await expect(result).rejects.toMatchObject({
        code: "BOOK_PROVIDER_UNAVAILABLE",
        httpStatus: 502,
      });
    });
  });

  describe("When the search text is missing or blank", () => {
    it.each([{}, { q: "   " }])(
      "Then it should fail with VALIDATION_ERROR on q (%j)",
      async (query) => {
        const service = createExternalBooksService([
          buildFakeProvider("google_books"),
        ]);

        const result = service.searchExternal(query);

        await expect(result).rejects.toMatchObject({
          code: "VALIDATION_ERROR",
          field: "q",
        });
      },
    );
  });
});
