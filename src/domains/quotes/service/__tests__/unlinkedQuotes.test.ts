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

const insertUnlinkedQuote = async (userId: string, source?: string) =>
  Quote.create({
    userId,
    text: "Una cita suelta",
    page: 4,
    ...(source && { source }),
  });

describe("Given quotes without a book", () => {
  describe("When the user lists their quotes", () => {
    it("Then the feed should include them, without ejemplarId or book, among the linked ones by date", async () => {
      const userId = newUserId();
      const { ejemplar } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(ejemplar.id, { text: "Con libro" }),
      );
      const unlinked = await insertUnlinkedQuote(userId, "Paper de Historia");

      const page = await QuotesService.listQuotes(userId, {});

      expect(page.total).toBe(2);
      expect(page.items.map((quote) => quote.text)).toEqual([
        "Una cita suelta",
        "Con libro",
      ]);
      expect(page.items[0]).toEqual({
        id: unlinked.id,
        text: "Una cita suelta",
        page: 4,
        source: "Paper de Historia",
        createdAt: expect.any(String),
      });
      expect(page.items[1]).not.toHaveProperty("source");
    });
  });

  describe("When the user opens one of them", () => {
    it("Then getQuote should return it without ejemplarId or book", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId);

      const quote = await QuotesService.getQuote(userId, unlinked.id);

      expect(quote).not.toHaveProperty("ejemplarId");
      expect(quote).not.toHaveProperty("book");
      expect(quote).not.toHaveProperty("source");
    });
  });

  describe("When the user edits the text of one of them", () => {
    it("Then updateQuote should keep it without a book", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId, "Fuente");

      const quote = await QuotesService.updateQuote(userId, unlinked.id, {
        text: "Editada",
      });

      expect(quote).toMatchObject({ text: "Editada", source: "Fuente" });
      expect(quote).not.toHaveProperty("book");
    });
  });

  describe("When the user deletes one of them", () => {
    it("Then deleteQuote should remove it", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId);

      await QuotesService.deleteQuote(userId, unlinked.id);

      expect(await Quote.countDocuments()).toBe(0);
    });
  });

  describe("When the user lists the books that have quotes", () => {
    it("Then listQuoteBooks should not list them as a book but count them in unlinkedCount", async () => {
      const userId = newUserId();
      await insertUnlinkedQuote(userId);
      await insertUnlinkedQuote(userId, "Fuente");
      await insertUnlinkedQuote(newUserId());

      expect(await QuotesService.listQuoteBooks(userId)).toEqual({
        items: [],
        unlinkedCount: 2,
      });
    });
  });

  describe("When the user deletes a book", () => {
    it("Then deleteBook should keep their quotes without a book", async () => {
      const userId = newUserId();
      const { book } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await insertUnlinkedQuote(userId);

      await BooksService.deleteBook(userId, book.id);

      expect(await Quote.countDocuments({ userId })).toBe(1);
    });
  });
});
