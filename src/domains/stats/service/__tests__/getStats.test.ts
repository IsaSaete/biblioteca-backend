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
import Quote from "../../../quotes/model/Quote.js";
import QuotesService from "../../../quotes/service/QuotesService.js";
import { buildCreateQuoteDto } from "../../../quotes/fixtures/quotes.fixtures.js";
import StatsService from "../StatsService.js";

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

describe("Given the StatsService.getStats function", () => {
  describe("When the user has no data", () => {
    it("Then it should return three zeros", async () => {
      expect(await StatsService.getStats(newUserId())).toEqual({
        books: 0,
        quotes: 0,
        favorites: 0,
      });
    });
  });

  describe("When the user has books, quotes and favorites", () => {
    it("Then it should count their Ejemplares, all their quotes and only the favorite Ejemplares", async () => {
      const userId = newUserId();
      const first = await BooksService.createBook(userId, buildCreateBookDto());
      await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13, title: "Marina" }),
      );
      await BooksService.updateEjemplar(userId, first.book.id, {
        favorite: true,
      });
      await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(first.ejemplar.id),
      );
      await QuotesService.createQuote(
        userId,
        buildCreateQuoteDto(first.ejemplar.id),
      );

      expect(await StatsService.getStats(userId)).toEqual({
        books: 2,
        quotes: 2,
        favorites: 1,
      });
    });
  });

  describe("When the user has quotes without a book", () => {
    it("Then quotes should include them", async () => {
      const userId = newUserId();
      await QuotesService.createQuote(userId, buildCreateQuoteDto(undefined));
      await QuotesService.createQuote(userId, buildCreateQuoteDto(undefined));

      expect(await StatsService.getStats(userId)).toEqual({
        books: 0,
        quotes: 2,
        favorites: 0,
      });
    });
  });

  describe("When another user has data", () => {
    it("Then it should not add up to the user's numbers", async () => {
      const other = newUserId();
      const { book, ejemplar } = await BooksService.createBook(
        other,
        buildCreateBookDto(),
      );
      await BooksService.updateEjemplar(other, book.id, { favorite: true });
      await QuotesService.createQuote(other, buildCreateQuoteDto(ejemplar.id));
      await QuotesService.createQuote(other, buildCreateQuoteDto(undefined));

      expect(await StatsService.getStats(newUserId())).toEqual({
        books: 0,
        quotes: 0,
        favorites: 0,
      });
    });
  });

  describe("When a favorite Ejemplar is no longer favorite", () => {
    it("Then favorites should not count it", async () => {
      const userId = newUserId();
      const { book } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await BooksService.updateEjemplar(userId, book.id, { favorite: true });
      await BooksService.updateEjemplar(userId, book.id, { favorite: false });

      expect((await StatsService.getStats(userId)).favorites).toBe(0);
    });
  });
});
