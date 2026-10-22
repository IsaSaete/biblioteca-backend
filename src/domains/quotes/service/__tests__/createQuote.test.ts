import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import BooksService from "../../../books/service/BooksService.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
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

const addBook = async (userId: string, overrides = {}) =>
  BooksService.createBook(userId, buildCreateBookDto(overrides));

describe("Given the QuotesService.createQuote function", () => {
  describe("When the user saves a quote with page for a book of their library", () => {
    it("Then it should return the quote with the book data and store it for the user", async () => {
      const userId = newUserId();
      const { book, ejemplar } = await addBook(userId);

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id),
      );

      expect(quote).toEqual({
        id: expect.any(String),
        ejemplarId: ejemplar.id,
        text: "Cuando se vive en una casa de libros, nunca se está solo.",
        page: 9,
        createdAt: expect.any(String),
        book: { id: book.id, title: book.title, authors: book.authors },
      });
      const stored = await Quote.findById(quote.id);
      expect(stored?.userId.toString()).toBe(userId);
      expect(stored?.origin).toBe("manual");
    });
  });

  describe("When the quote has no page", () => {
    it("Then it should omit page from the result", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId);

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id, { page: undefined }),
      );

      expect(quote).not.toHaveProperty("page");
    });
  });

  describe("When the text has surrounding spaces and the origin is ocr", () => {
    it("Then it should trim the text and store the origin without returning it", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId);

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id, {
          text: "  Un texto  ",
          origin: "ocr",
        }),
      );

      expect(quote.text).toBe("Un texto");
      expect(quote).not.toHaveProperty("origin");
      expect((await Quote.findById(quote.id))?.origin).toBe("ocr");
    });
  });

  describe("When the Ejemplar has overrides for title and authors", () => {
    it("Then the quote should carry the overridden title and authors", async () => {
      const userId = newUserId();
      const { book, ejemplar } = await addBook(userId);
      await BooksService.updateEjemplar(userId, book.id, {
        overrides: { title: "Mi título", authors: ["Otra Autora"] },
      });

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id),
      );

      expect(quote.book).toEqual({
        id: book.id,
        title: "Mi título",
        authors: ["Otra Autora"],
      });
    });
  });

  describe("When the Ejemplar belongs to another user", () => {
    it("Then it should throw BOOK_NOT_FOUND and store nothing", async () => {
      const { ejemplar } = await addBook(newUserId());

      await expect(
        QuotesService.createQuote(
          newUserId(),
          buildCreateQuoteDto(ejemplar.id),
        ),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
      expect(await Quote.countDocuments()).toBe(0);
    });
  });

  describe("When the ejemplarId is not a valid ObjectId", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      await expect(
        QuotesService.createQuote(
          newUserId(),
          buildCreateQuoteDto("no-es-un-id"),
        ),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });

  describe.each([
    ["text is missing", { text: undefined }, "text"],
    ["text is only spaces", { text: "   " }, "text"],
    ["text has more than 5000 characters", { text: "a".repeat(5001) }, "text"],
    ["page is zero", { page: 0 }, "page"],
    ["page is not an integer", { page: 2.5 }, "page"],
    ["origin is unknown", { origin: "voz" }, "origin"],
    ["source is not a string", { ejemplarId: undefined, source: 5 }, "source"],
    [
      "source has more than 120 characters",
      { ejemplarId: undefined, source: "a".repeat(121) },
      "source",
    ],
  ])("When %s", (_case, override, field) => {
    it(`Then it should throw VALIDATION_ERROR on ${field}`, async () => {
      const body = buildCreateQuoteDto(new Types.ObjectId().toString(), {
        ...(override as object),
      });

      await expect(
        QuotesService.createQuote(newUserId(), body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field });
    });
  });

  describe("When the text has exactly 5000 characters", () => {
    it("Then it should accept it", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId);

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id, { text: "a".repeat(5000) }),
      );

      expect(quote.text).toHaveLength(5000);
    });
  });
});

describe("Given the QuotesService.createQuote function without ejemplarId", () => {
  describe("When the user saves a quote with a source", () => {
    it("Then it should store it without a book and return it without ejemplarId or book", async () => {
      const userId = newUserId();

      const quote = await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(undefined, {
          source: "  Paper de Historia, UNED ",
        }),
      );

      expect(quote).toEqual({
        id: expect.any(String),
        text: "Cuando se vive en una casa de libros, nunca se está solo.",
        page: 9,
        source: "Paper de Historia, UNED",
        createdAt: expect.any(String),
      });
      const stored = await Quote.findById(quote.id);
      expect(stored?.userId.toString()).toBe(userId);
      expect(stored?.ejemplarId).toBeUndefined();
    });
  });

  describe("When the source is empty", () => {
    it("Then it should save the quote without source", async () => {
      const quote = await QuotesService.createQuote(
        newUserId(),
        buildCreateQuoteDto(undefined, { source: "   " }),
      );

      expect(quote).not.toHaveProperty("source");
    });
  });

  describe("When the quote has an ejemplarId and a source", () => {
    it("Then it should throw VALIDATION_ERROR on source and store nothing", async () => {
      const userId = newUserId();
      const { ejemplar } = await addBook(userId);

      await expect(
        QuotesService.createQuote(
          userId,
          buildCreateQuoteDto(ejemplar.id, { source: "Paper" }),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "source" });
      expect(await Quote.countDocuments()).toBe(0);
    });
  });
});
