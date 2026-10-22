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
import QuotesService from "../QuotesService.js";
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

const addQuote = async (userId: string, overrides = {}) => {
  const { book, ejemplar } = await BooksService.createBook(
    userId,
    buildCreateBookDto(),
  );
  const quote = await QuotesService.createQuote(
    userId,
    buildCreateQuoteDto(ejemplar.id, overrides),
  );

  return { book, ejemplar, quote };
};

describe("Given the QuotesService.getQuote function", () => {
  describe("When the quote belongs to the user", () => {
    it("Then it should return it with the book data and overrides applied", async () => {
      const userId = newUserId();
      const { book, quote } = await addQuote(userId);
      await BooksService.updateEjemplar(userId, book.id, {
        overrides: { title: "Mi título" },
      });

      const result = await QuotesService.getQuote(userId, quote.id);

      expect(result).toMatchObject({
        id: quote.id,
        text: quote.text,
        book: { id: book.id, title: "Mi título", authors: book.authors },
      });
    });
  });

  describe("When the quote belongs to another user or the id is malformed", () => {
    it("Then it should throw QUOTE_NOT_FOUND", async () => {
      const { quote } = await addQuote(newUserId());

      await expect(
        QuotesService.getQuote(newUserId(), quote.id),
      ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
      await expect(
        QuotesService.getQuote(newUserId(), "no-es-un-id"),
      ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
    });
  });
});

describe("Given the QuotesService.updateQuote function", () => {
  describe("When the user changes the text and the page", () => {
    it("Then it should return the updated quote and keep createdAt", async () => {
      const userId = newUserId();
      const { quote } = await addQuote(userId);

      const result = await QuotesService.updateQuote(userId, quote.id, {
        text: "  Nuevo texto ",
        page: 12,
      });

      expect(result).toMatchObject({ text: "Nuevo texto", page: 12 });
      expect(result.createdAt).toBe(quote.createdAt);
    });
  });

  describe("When the user sends only the text", () => {
    it("Then it should keep the page", async () => {
      const userId = newUserId();
      const { quote } = await addQuote(userId);

      const result = await QuotesService.updateQuote(userId, quote.id, {
        text: "Otro",
      });

      expect(result.page).toBe(9);
    });
  });

  describe("When the page is null", () => {
    it("Then it should remove the page", async () => {
      const userId = newUserId();
      const { quote } = await addQuote(userId);

      const result = await QuotesService.updateQuote(userId, quote.id, {
        page: null,
      });

      expect(result).not.toHaveProperty("page");
      expect((await Quote.findById(quote.id))?.page).toBeUndefined();
    });
  });

  describe("When the body is empty", () => {
    it("Then it should return the quote unchanged", async () => {
      const userId = newUserId();
      const { quote } = await addQuote(userId);

      expect(await QuotesService.updateQuote(userId, quote.id, {})).toEqual(
        quote,
      );
    });
  });

  describe.each([
    ["text is null", { text: null }, "text"],
    ["text is only spaces", { text: " " }, "text"],
    ["text has more than 5000 characters", { text: "a".repeat(5001) }, "text"],
    ["page is zero", { page: 0 }, "page"],
    ["page is not an integer", { page: 1.5 }, "page"],
  ])("When %s", (_case, body, field) => {
    it(`Then it should throw VALIDATION_ERROR on ${field}`, async () => {
      const userId = newUserId();
      const { quote } = await addQuote(userId);

      await expect(
        QuotesService.updateQuote(userId, quote.id, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field });
    });
  });

  describe("When the quote belongs to another user", () => {
    it("Then it should throw QUOTE_NOT_FOUND and leave it untouched", async () => {
      const { quote } = await addQuote(newUserId());

      await expect(
        QuotesService.updateQuote(newUserId(), quote.id, { text: "Hack" }),
      ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
      expect((await Quote.findById(quote.id))?.text).toBe(quote.text);
    });
  });
});

describe("Given the QuotesService.deleteQuote function", () => {
  describe("When the quote belongs to the user", () => {
    it("Then it should remove only that quote", async () => {
      const userId = newUserId();
      const { ejemplar, quote } = await addQuote(userId);
      await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id, { text: "Otra" }),
      );

      await QuotesService.deleteQuote(userId, quote.id);

      expect(await Quote.findById(quote.id)).toBeNull();
      expect(await Quote.countDocuments()).toBe(1);
    });
  });

  describe("When the quote belongs to another user or the id is malformed", () => {
    it("Then it should throw QUOTE_NOT_FOUND and keep the quote", async () => {
      const { quote } = await addQuote(newUserId());

      await expect(
        QuotesService.deleteQuote(newUserId(), quote.id),
      ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
      await expect(
        QuotesService.deleteQuote(newUserId(), "no-es-un-id"),
      ).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
      expect(await Quote.countDocuments()).toBe(1);
    });
  });
});

describe("Given the QuotesService.listQuoteBooks function", () => {
  describe("When the user has no quotes", () => {
    it("Then it should return an empty list", async () => {
      await BooksService.createBook(newUserId(), buildCreateBookDto());

      expect(await QuotesService.listQuoteBooks(newUserId())).toEqual([]);
    });
  });

  describe("When the user has quotes in several books and a book without quotes", () => {
    it("Then it should list only books with quotes, with their count, sorted by title", async () => {
      const userId = newUserId();
      const zeta = await BooksService.createBook(
        userId,
        buildCreateBookDto({ title: "Zeta" }),
      );
      const alfa = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13, title: "Álamo" }),
      );
      await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: undefined, title: "Sin citas" }),
      );
      for (const text of ["a", "b"]) {
        await QuotesService.createQuote(
          userId,
          buildCreateQuoteDto(zeta.ejemplar.id, { text }),
        );
      }
      await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(alfa.ejemplar.id),
      );

      expect(await QuotesService.listQuoteBooks(userId)).toEqual([
        { bookId: alfa.book.id, title: "Álamo", count: 1 },
        { bookId: zeta.book.id, title: "Zeta", count: 2 },
      ]);
    });
  });

  describe("When the Ejemplar has an overridden title", () => {
    it("Then it should use the overridden title", async () => {
      const userId = newUserId();
      const { book } = await addQuote(userId);
      await BooksService.updateEjemplar(userId, book.id, {
        overrides: { title: "Mi título" },
      });

      const [item] = await QuotesService.listQuoteBooks(userId);

      expect(item.title).toBe("Mi título");
    });
  });

  describe("When another user has quotes", () => {
    it("Then it should not include their books", async () => {
      await addQuote(newUserId());

      expect(await QuotesService.listQuoteBooks(newUserId())).toEqual([]);
    });
  });
});
