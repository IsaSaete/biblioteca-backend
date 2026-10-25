import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import BooksService from "../../../books/service/BooksService.js";
import {
  OTHER_EDITION_ISBN_13,
  buildCreateBookDto,
} from "../../../books/fixtures/books.fixtures.js";
import Quote from "../../model/Quote.js";
import QuotesService, { QUOTES_PAGE_SIZE } from "../QuotesService.js";
import { buildCreateQuoteDto } from "../../fixtures/quotes.fixtures.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
  await Quote.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const newUserId = (): string => new Types.ObjectId().toString();

const addBook = (userId: string, title: string, isbn?: string) =>
  BooksService.createBook(
    userId,
    buildCreateBookDto({ title, isbn: isbn ?? undefined }),
  );

const addQuote = (
  userId: string,
  ejemplarId: string | undefined,
  text: string,
) =>
  QuotesService.createQuote(userId, buildCreateQuoteDto(ejemplarId, { text }));

const listTexts = async (userId: string, query: object = {}) =>
  (
    await QuotesService.listQuotes(userId, { sort: "book", ...query })
  ).items.map((quote) => quote.text);

describe("Given the QuotesService.listQuotes function with sort=book", () => {
  describe("When the user has quotes in several books", () => {
    it("Then it should group them by book title A-Z and keep the saving order inside each book", async () => {
      const userId = newUserId();
      const zeta = await addBook(userId, "Zeta");
      const alamo = await addBook(userId, "Álamo", OTHER_EDITION_ISBN_13);
      await addQuote(userId, zeta.ejemplar.id, "Zeta 1");
      await addQuote(userId, alamo.ejemplar.id, "Álamo 1");
      await addQuote(userId, zeta.ejemplar.id, "Zeta 2");
      await addQuote(userId, alamo.ejemplar.id, "Álamo 2");

      expect(await listTexts(userId)).toEqual([
        "Álamo 1",
        "Álamo 2",
        "Zeta 1",
        "Zeta 2",
      ]);
    });
  });

  describe("When the titles differ only in case or accents", () => {
    it("Then it should sort them without distinguishing case or accents", async () => {
      const userId = newUserId();
      const beta = await addBook(userId, "beta");
      const alpha = await addBook(userId, "ÁLFA", OTHER_EDITION_ISBN_13);
      await addQuote(userId, beta.ejemplar.id, "Beta");
      await addQuote(userId, alpha.ejemplar.id, "Alfa");

      expect(await listTexts(userId)).toEqual(["Alfa", "Beta"]);
    });
  });

  describe("When the sort is book_desc", () => {
    it("Then it should invert only the books, keep the saving order inside each one and leave the quotes without a book last", async () => {
      const userId = newUserId();
      const zeta = await addBook(userId, "Zeta");
      const alamo = await addBook(userId, "Álamo", OTHER_EDITION_ISBN_13);
      await addQuote(userId, zeta.ejemplar.id, "Zeta 1");
      await addQuote(userId, undefined, "Suelta 1");
      await addQuote(userId, alamo.ejemplar.id, "Álamo 1");
      await addQuote(userId, zeta.ejemplar.id, "Zeta 2");
      await addQuote(userId, undefined, "Suelta 2");
      await addQuote(userId, alamo.ejemplar.id, "Álamo 2");

      expect(await listTexts(userId, { sort: "book_desc" })).toEqual([
        "Zeta 1",
        "Zeta 2",
        "Álamo 1",
        "Álamo 2",
        "Suelta 1",
        "Suelta 2",
      ]);
    });
  });

  describe("When the sort is book_desc and the user corrected a title", () => {
    it("Then it should sort by the corrected title", async () => {
      const userId = newUserId();
      const first = await addBook(userId, "Aaa original");
      const second = await addBook(userId, "Mmm", OTHER_EDITION_ISBN_13);
      await BooksService.updateEjemplar(userId, first.book.id, {
        overrides: { title: "Zzz corregido" },
      });
      await addQuote(userId, first.ejemplar.id, "Del primero");
      await addQuote(userId, second.ejemplar.id, "Del segundo");

      expect(await listTexts(userId, { sort: "book_desc" })).toEqual([
        "Del primero",
        "Del segundo",
      ]);
    });
  });

  describe("When the sort is book_desc and the quotes are more than one page", () => {
    it("Then the cursor should walk the whole order without repeating or skipping any", async () => {
      const userId = newUserId();
      const beta = await addBook(userId, "Beta");
      const alfa = await addBook(userId, "Alfa", OTHER_EDITION_ISBN_13);
      const expected: string[] = [];

      for (let index = 0; index < 15; index += 1) {
        await addQuote(userId, beta.ejemplar.id, `Beta ${index}`);
        await addQuote(userId, alfa.ejemplar.id, `Alfa ${index}`);
      }
      await addQuote(userId, undefined, "Suelta");
      for (let index = 0; index < 15; index += 1)
        expected.push(`Beta ${index}`);
      for (let index = 0; index < 15; index += 1)
        expected.push(`Alfa ${index}`);
      expected.push("Suelta");

      const first = await QuotesService.listQuotes(userId, {
        sort: "book_desc",
      });
      const second = await QuotesService.listQuotes(userId, {
        sort: "book_desc",
        cursor: first.nextCursor,
      });

      expect(first.items).toHaveLength(QUOTES_PAGE_SIZE);
      expect(second.nextCursor).toBeNull();
      expect(
        [...first.items, ...second.items].map((quote) => quote.text),
      ).toEqual(expected);
    });
  });

  describe("When a cursor from book is used with book_desc", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId, "Beta");
      for (let index = 0; index <= QUOTES_PAGE_SIZE; index += 1) {
        await addQuote(userId, ejemplar.id, `Cita ${index}`);
      }
      const ascending = await QuotesService.listQuotes(userId, {
        sort: "book",
      });

      await expect(
        QuotesService.listQuotes(userId, {
          sort: "book_desc",
          cursor: ascending.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "cursor" });
    });
  });

  describe("When the user corrected the title of a book", () => {
    it("Then it should sort by the corrected title", async () => {
      const userId = newUserId();
      const first = await addBook(userId, "Aaa original");
      const second = await addBook(userId, "Mmm", OTHER_EDITION_ISBN_13);
      await BooksService.updateEjemplar(userId, first.book.id, {
        overrides: { title: "Zzz corregido" },
      });
      await addQuote(userId, first.ejemplar.id, "Del primero");
      await addQuote(userId, second.ejemplar.id, "Del segundo");

      expect(await listTexts(userId)).toEqual(["Del segundo", "Del primero"]);
    });
  });

  describe("When two different books have the same title", () => {
    it("Then it should keep the quotes of each book together", async () => {
      const userId = newUserId();
      const one = await addBook(userId, "Mismo título");
      const two = await addBook(userId, "Mismo título", OTHER_EDITION_ISBN_13);
      await addQuote(userId, one.ejemplar.id, "Uno A");
      await addQuote(userId, two.ejemplar.id, "Dos A");
      await addQuote(userId, one.ejemplar.id, "Uno B");
      await addQuote(userId, two.ejemplar.id, "Dos B");

      const texts = await listTexts(userId);
      const startsWithUno = texts.map((text) => text.startsWith("Uno"));

      // Cuál de los dos libros va primero no importa; sí que no se mezclen.
      expect(["true,true,false,false", "false,false,true,true"]).toContain(
        startsWithUno.join(),
      );
    });
  });

  describe("When the user has quotes without a book", () => {
    it("Then they should go last, in saving order", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId, "Zeta");
      await addQuote(userId, undefined, "Suelta 1");
      await addQuote(userId, ejemplar.id, "Con libro");
      await addQuote(userId, undefined, "Suelta 2");

      expect(await listTexts(userId)).toEqual([
        "Con libro",
        "Suelta 1",
        "Suelta 2",
      ]);
    });
  });

  describe("When the quotes are more than one page", () => {
    it("Then the cursor should walk the whole order without repeating or skipping any", async () => {
      const userId = newUserId();
      const one = await addBook(userId, "Beta");
      const two = await addBook(userId, "Alfa", OTHER_EDITION_ISBN_13);
      const expected: string[] = [];

      for (let index = 0; index < 15; index += 1) {
        await addQuote(userId, one.ejemplar.id, `Beta ${index}`);
        await addQuote(userId, two.ejemplar.id, `Alfa ${index}`);
      }
      await addQuote(userId, undefined, "Suelta");
      for (let index = 0; index < 15; index += 1)
        expected.push(`Alfa ${index}`);
      for (let index = 0; index < 15; index += 1)
        expected.push(`Beta ${index}`);
      expected.push("Suelta");

      const first = await QuotesService.listQuotes(userId, { sort: "book" });
      const second = await QuotesService.listQuotes(userId, {
        sort: "book",
        cursor: first.nextCursor,
      });

      expect(first.items).toHaveLength(QUOTES_PAGE_SIZE);
      expect(first.total).toBe(31);
      expect(second.nextCursor).toBeNull();
      expect(
        [...first.items, ...second.items].map((quote) => quote.text),
      ).toEqual(expected);
    });
  });

  describe("When it is combined with the book filter or unlinked", () => {
    it("Then it should apply the filter and keep the order", async () => {
      const userId = newUserId();
      const one = await addBook(userId, "Beta");
      const two = await addBook(userId, "Alfa", OTHER_EDITION_ISBN_13);
      await addQuote(userId, one.ejemplar.id, "Beta 1");
      await addQuote(userId, two.ejemplar.id, "Alfa 1");
      await addQuote(userId, undefined, "Suelta");

      expect(await listTexts(userId, { bookId: one.book.id })).toEqual([
        "Beta 1",
      ]);
      expect(await listTexts(userId, { unlinked: "true" })).toEqual(["Suelta"]);
    });
  });

  describe("When another user has quotes", () => {
    it("Then they should not appear", async () => {
      const other = newUserId();
      const { ejemplar } = await addBook(other, "Ajeno");
      await addQuote(other, ejemplar.id, "Ajena");

      expect(await listTexts(newUserId())).toEqual([]);
    });
  });

  describe("When the cursor is not valid for the book order", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId, "Beta");
      await addQuote(userId, ejemplar.id, "Cita");
      const corrupt = Buffer.from(
        JSON.stringify({ sort: "book", id: ejemplar.id, value: "no-json" }),
      ).toString("base64url");

      await expect(
        QuotesService.listQuotes(userId, { sort: "book", cursor: corrupt }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "cursor" });
    });
  });
});
