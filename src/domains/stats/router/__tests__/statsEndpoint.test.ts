import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import createSessionCookie from "../../../../test/createSessionCookie.js";
import app from "../../../../server/app.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import BooksService from "../../../books/service/BooksService.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
import Quote from "../../../quotes/model/Quote.js";
import QuotesService from "../../../quotes/service/QuotesService.js";
import { buildCreateQuoteDto } from "../../../quotes/fixtures/quotes.fixtures.js";

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

describe("Given the GET /stats endpoint", () => {
  describe("When a logged-in user has no data", () => {
    it("Then it should respond 200 with { books: 0, quotes: 0, favorites: 0 }", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app).get("/stats").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ books: 0, quotes: 0, favorites: 0 });
    });
  });

  describe("When the user has books, a favorite and quotes with and without a book", () => {
    it("Then it should respond 200 with their counts, without requiring CSRF", async () => {
      const { cookie, userId } = createSessionCookie();
      const { book, ejemplar } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await BooksService.updateEjemplar(userId, book.id, { favorite: true });
      await QuotesService.createQuote(userId, buildCreateQuoteDto(ejemplar.id));
      await QuotesService.createQuote(userId, buildCreateQuoteDto(undefined));

      const response = await request(app).get("/stats").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ books: 1, quotes: 2, favorites: 1 });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/stats");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
