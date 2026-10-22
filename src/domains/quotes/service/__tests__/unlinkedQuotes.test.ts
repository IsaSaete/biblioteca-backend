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
    it("Then listQuoteBooks should not count the quotes without a book as a book", async () => {
      const userId = newUserId();
      await insertUnlinkedQuote(userId);

      expect(await QuotesService.listQuoteBooks(userId)).toEqual([]);
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

describe("Given the QuotesService.updateQuote function and the source", () => {
  describe("When the user changes the source of a quote without a book", () => {
    it("Then it should save the trimmed source and keep the rest", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId, "Antigua");

      const quote = await QuotesService.updateQuote(userId, unlinked.id, {
        source: "  Nueva fuente ",
      });

      expect(quote).toMatchObject({
        text: "Una cita suelta",
        page: 4,
        source: "Nueva fuente",
      });
    });
  });

  describe.each([
    ["null", null],
    ["an empty string", "  "],
  ])("When the source is %s", (_case, source) => {
    it("Then it should remove the source", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId, "Antigua");

      const quote = await QuotesService.updateQuote(userId, unlinked.id, {
        source,
      });

      expect(quote).not.toHaveProperty("source");
      expect((await Quote.findById(unlinked.id))?.source).toBeUndefined();
    });
  });

  describe("When the source has more than 120 characters", () => {
    it("Then it should throw VALIDATION_ERROR on source", async () => {
      const userId = newUserId();
      const unlinked = await insertUnlinkedQuote(userId);

      await expect(
        QuotesService.updateQuote(userId, unlinked.id, {
          source: "a".repeat(121),
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "source" });
    });
  });

  describe("When the quote has a book", () => {
    it.each([
      ["a text", "Paper"],
      ["null", null],
    ])(
      "Then sending source as %s should throw VALIDATION_ERROR on source",
      async (_case, source) => {
        const userId = newUserId();
        const { ejemplar } = await BooksService.createBook(
          userId,
          buildCreateBookDto(),
        );
        const quote = await QuotesService.createQuote(
          userId,
          buildCreateQuoteDto(ejemplar.id),
        );

        await expect(
          QuotesService.updateQuote(userId, quote.id, { source }),
        ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "source" });
      },
    );
  });
});
