import request from "supertest";
import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import createSessionCookie, {
  CSRF_TOKEN,
} from "../../../../test/createSessionCookie.js";
import app from "../../../../server/app.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import BooksService from "../../../books/service/BooksService.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
import Quote from "../../model/Quote.js";
import { QUOTES_PAGE_SIZE } from "../../service/QuotesService.js";
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

const postQuote = (cookie: string, body: unknown) =>
  request(app)
    .post("/quotes")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body as object);

const addBook = (userId: string) =>
  BooksService.createBook(userId, buildCreateBookDto());

describe("Given the POST /quotes endpoint", () => {
  describe("When a logged-in user saves a quote for one of their books", () => {
    it("Then it should respond 201 with { quote } in the contract shape", async () => {
      const { cookie, userId } = createSessionCookie();
      const { book, ejemplar } = await addBook(userId);

      const response = await postQuote(
        cookie,
        buildCreateQuoteDto(ejemplar.id),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        quote: {
          id: expect.any(String),
          ejemplarId: ejemplar.id,
          text: "Cuando se vive en una casa de libros, nunca se está solo.",
          page: 9,
          createdAt: expect.any(String),
          book: { id: book.id, title: book.title, authors: book.authors },
        },
      });
    });
  });

  describe("When the body tries to set the owner", () => {
    it("Then the quote should belong to the session user", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);

      const response = await postQuote(cookie, {
        ...buildCreateQuoteDto(ejemplar.id),
        userId: new Types.ObjectId().toString(),
      });

      const stored = await Quote.findById(response.body.quote.id);
      expect(stored?.userId.toString()).toBe(userId);
    });
  });

  describe("When the text is empty", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field text", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);

      const response = await postQuote(
        cookie,
        buildCreateQuoteDto(ejemplar.id, { text: " " }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "text",
      });
    });
  });

  describe("When the Ejemplar belongs to another user", () => {
    it("Then it should respond 404 BOOK_NOT_FOUND", async () => {
      const { cookie } = createSessionCookie();
      const { ejemplar } = await addBook(new Types.ObjectId().toString());

      const response = await postQuote(
        cookie,
        buildCreateQuoteDto(ejemplar.id),
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/quotes")
        .send(buildCreateQuoteDto(new Types.ObjectId().toString()));

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .post("/quotes")
        .set("Cookie", cookie)
        .send(buildCreateQuoteDto(new Types.ObjectId().toString()));

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });
});

describe("Given the GET /quotes endpoint", () => {
  describe("When the user has quotes", () => {
    it("Then it should respond 200 with { items, nextCursor, total }", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);
      await postQuote(cookie, buildCreateQuoteDto(ejemplar.id));

      const response = await request(app).get("/quotes").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [
          expect.objectContaining({
            ejemplarId: ejemplar.id,
            book: expect.objectContaining({ title: expect.any(String) }),
          }),
        ],
        nextCursor: null,
        total: 1,
      });
    });
  });

  describe("When filtering by the bookId of a book with quotes", () => {
    it("Then it should return only that book's quotes", async () => {
      const { cookie, userId } = createSessionCookie();
      const first = await addBook(userId);
      const second = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: undefined, title: "Otro libro" }),
      );
      await postQuote(cookie, buildCreateQuoteDto(first.ejemplar.id));
      await postQuote(cookie, buildCreateQuoteDto(second.ejemplar.id));

      const response = await request(app)
        .get("/quotes")
        .query({ bookId: second.book.id })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.items[0].book.id).toBe(second.book.id);
    });
  });

  describe("When the bookId is not in the user's library", () => {
    it("Then it should respond 404 BOOK_NOT_FOUND", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/quotes")
        .query({ bookId: new Types.ObjectId().toString() })
        .set("Cookie", cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
    });
  });

  describe("When there are more quotes than one page", () => {
    it("Then the nextCursor should return the remaining quotes", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);
      await Quote.insertMany(
        Array.from({ length: QUOTES_PAGE_SIZE + 1 }, (_, index) => ({
          userId,
          ejemplarId: ejemplar.id,
          text: `Cita ${index}`,
        })),
      );

      const first = await request(app).get("/quotes").set("Cookie", cookie);
      const second = await request(app)
        .get("/quotes")
        .query({ cursor: first.body.nextCursor })
        .set("Cookie", cookie);

      expect(first.body.items).toHaveLength(QUOTES_PAGE_SIZE);
      expect(first.body.total).toBe(QUOTES_PAGE_SIZE + 1);
      expect(second.body.items).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();
    });
  });

  describe("When the cursor is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field cursor", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/quotes")
        .query({ cursor: "basura" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "cursor",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/quotes");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
