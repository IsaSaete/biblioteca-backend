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

const addQuotes = async (
  userId: string,
  ejemplarId: string,
  texts: string[],
): Promise<void> => {
  for (const text of texts) {
    await QuotesService.createQuote(
      userId,
      buildCreateQuoteDto(ejemplarId, { text }),
    );
  }
};

describe("Given the QuotesService.listQuotes function", () => {
  describe("When the user has no quotes", () => {
    it("Then it should return an empty page with total 0 and no cursor", async () => {
      const page = await QuotesService.listQuotes(newUserId(), {});

      expect(page).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When the user has quotes in several books", () => {
    it("Then it should list them newest first with their book data", async () => {
      const userId = newUserId();
      const first = await BooksService.createBook(userId, buildCreateBookDto());
      const second = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13, title: "Marina" }),
      );
      await addQuotes(userId, first.ejemplar.id, ["Primera"]);
      await addQuotes(userId, second.ejemplar.id, ["Segunda"]);

      const page = await QuotesService.listQuotes(userId, {});

      expect(page.items.map((quote) => quote.text)).toEqual([
        "Segunda",
        "Primera",
      ]);
      expect(page.items[0].book.title).toBe("Marina");
      expect(page.items[1].book.title).toBe(first.book.title);
      expect(page.total).toBe(2);
    });
  });

  describe("When another user has quotes", () => {
    it("Then it should not list or count them", async () => {
      const other = newUserId();
      const { ejemplar } = await BooksService.createBook(
        other,
        buildCreateBookDto(),
      );
      await addQuotes(other, ejemplar.id, ["Ajena"]);

      const page = await QuotesService.listQuotes(newUserId(), {});

      expect(page).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When filtering by bookId", () => {
    it("Then it should return only that book's quotes and its total", async () => {
      const userId = newUserId();
      const first = await BooksService.createBook(userId, buildCreateBookDto());
      const second = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13, title: "Marina" }),
      );
      await addQuotes(userId, first.ejemplar.id, ["A", "B"]);
      await addQuotes(userId, second.ejemplar.id, ["C"]);

      const page = await QuotesService.listQuotes(userId, {
        bookId: first.book.id,
      });

      expect(page.items.map((quote) => quote.text)).toEqual(["B", "A"]);
      expect(page.total).toBe(2);
    });
  });

  describe("When the bookId is not in the user's library or is malformed", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      const { book } = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );

      await expect(
        QuotesService.listQuotes(newUserId(), { bookId: book.id }),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
      await expect(
        QuotesService.listQuotes(newUserId(), { bookId: "no-es-un-id" }),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });

  describe("When the Ejemplar has overrides", () => {
    it("Then the listed quotes should carry the overridden title and authors", async () => {
      const userId = newUserId();
      const { book, ejemplar } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await addQuotes(userId, ejemplar.id, ["Cita"]);
      await BooksService.updateEjemplar(userId, book.id, {
        overrides: { title: "Mi título", authors: ["Otra Autora"] },
      });

      const page = await QuotesService.listQuotes(userId, {});

      expect(page.items[0].book).toEqual({
        id: book.id,
        title: "Mi título",
        authors: ["Otra Autora"],
      });
    });
  });

  describe("When there are more quotes than one page", () => {
    it("Then it should paginate with the cursor without repeating or skipping any", async () => {
      const userId = newUserId();
      const { ejemplar } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      const texts = Array.from(
        { length: QUOTES_PAGE_SIZE + 1 },
        (_, index) => `Cita ${index}`,
      );
      await addQuotes(userId, ejemplar.id, texts);

      const firstPage = await QuotesService.listQuotes(userId, {});
      const secondPage = await QuotesService.listQuotes(userId, {
        cursor: firstPage.nextCursor,
      });

      expect(firstPage.items).toHaveLength(QUOTES_PAGE_SIZE);
      expect(firstPage.nextCursor).toEqual(expect.any(String));
      expect(firstPage.total).toBe(QUOTES_PAGE_SIZE + 1);
      expect(secondPage.items.map((quote) => quote.text)).toEqual(["Cita 0"]);
      expect(secondPage.nextCursor).toBeNull();
      expect(secondPage.total).toBe(QUOTES_PAGE_SIZE + 1);
    });
  });

  describe("When the cursor is not valid", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", async () => {
      await expect(
        QuotesService.listQuotes(newUserId(), { cursor: "basura" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "cursor" });
    });
  });
});
