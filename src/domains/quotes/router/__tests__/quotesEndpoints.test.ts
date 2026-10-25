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

  describe("When the user saves a quote without a book", () => {
    it("Then it should respond 201 with a quote without ejemplarId or book and with its source", async () => {
      const { cookie } = createSessionCookie();

      const response = await postQuote(
        cookie,
        buildCreateQuoteDto(undefined, { source: "Biblioteca de Triana" }),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        quote: {
          id: expect.any(String),
          text: "Cuando se vive en una casa de libros, nunca se está solo.",
          page: 9,
          source: "Biblioteca de Triana",
          createdAt: expect.any(String),
        },
      });
    });
  });

  describe("When the quote has an ejemplarId and a source", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field source", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);

      const response = await postQuote(
        cookie,
        buildCreateQuoteDto(ejemplar.id, { source: "Paper" }),
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "source",
      });
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

  describe("When the sort is oldest", () => {
    it("Then it should respond 200 with the oldest quote first", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);
      for (const text of ["Primera", "Segunda"]) {
        await postQuote(cookie, buildCreateQuoteDto(ejemplar.id, { text }));
      }

      const response = await request(app)
        .get("/quotes")
        .query({ sort: "oldest" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map((quote: { text: string }) => quote.text),
      ).toEqual(["Primera", "Segunda"]);
    });
  });

  describe("When the sort is book", () => {
    it("Then it should respond 200 with the quotes grouped by book title and the ones without a book last", async () => {
      const { cookie, userId } = createSessionCookie();
      const zeta = await BooksService.createBook(
        userId,
        buildCreateBookDto({ title: "Zeta" }),
      );
      const alfa = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: undefined, title: "Alfa" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(zeta.ejemplar.id, { text: "De Zeta" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(undefined, { text: "Suelta" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(alfa.ejemplar.id, { text: "De Alfa" }),
      );

      const response = await request(app)
        .get("/quotes")
        .query({ sort: "book" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map((quote: { text: string }) => quote.text),
      ).toEqual(["De Alfa", "De Zeta", "Suelta"]);
      expect(response.body.total).toBe(3);
    });
  });

  describe("When the sort is book_desc", () => {
    it("Then it should respond 200 with the books from Z to A and the quotes without a book last", async () => {
      const { cookie, userId } = createSessionCookie();
      const zeta = await BooksService.createBook(
        userId,
        buildCreateBookDto({ title: "Zeta" }),
      );
      const alfa = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: undefined, title: "Alfa" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(alfa.ejemplar.id, { text: "De Alfa" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(undefined, { text: "Suelta" }),
      );
      await postQuote(
        cookie,
        buildCreateQuoteDto(zeta.ejemplar.id, { text: "De Zeta" }),
      );

      const response = await request(app)
        .get("/quotes")
        .query({ sort: "book_desc" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map((quote: { text: string }) => quote.text),
      ).toEqual(["De Zeta", "De Alfa", "Suelta"]);
    });
  });

  describe("When the sort is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field sort", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/quotes")
        .query({ sort: "random" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "sort",
      });
    });
  });

  describe("When filtering by unlinked=true", () => {
    it("Then it should return only the quotes without a book", async () => {
      const { cookie, userId } = createSessionCookie();
      const { ejemplar } = await addBook(userId);
      await postQuote(cookie, buildCreateQuoteDto(ejemplar.id));
      await postQuote(
        cookie,
        buildCreateQuoteDto(undefined, { source: "Un paper" }),
      );

      const response = await request(app)
        .get("/quotes")
        .query({ unlinked: "true" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.items[0]).toMatchObject({ source: "Un paper" });
      expect(response.body.items[0]).not.toHaveProperty("book");
    });
  });

  describe("When unlinked=true is combined with bookId", () => {
    it("Then it should respond 400 VALIDATION_ERROR", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/quotes")
        .query({ unlinked: "true", bookId: new Types.ObjectId().toString() })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
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

const patchQuote = (cookie: string, id: string, body: unknown) =>
  request(app)
    .patch(`/quotes/${id}`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body as object);

const addQuote = async (userId: string) => {
  const { book, ejemplar } = await addBook(userId);
  const stored = await Quote.create({
    userId,
    ejemplarId: ejemplar.id,
    text: "Una cita",
    page: 3,
  });

  return { book, ejemplar, id: stored.id as string };
};

describe("Given the GET /quotes/:id endpoint", () => {
  describe("When the quote belongs to the user", () => {
    it("Then it should respond 200 with { quote } in the contract shape", async () => {
      const { cookie, userId } = createSessionCookie();
      const { book, ejemplar, id } = await addQuote(userId);

      const response = await request(app)
        .get(`/quotes/${id}`)
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        quote: {
          id,
          ejemplarId: ejemplar.id,
          text: "Una cita",
          page: 3,
          createdAt: expect.any(String),
          book: { id: book.id, title: book.title, authors: book.authors },
        },
      });
    });
  });

  describe("When the quote belongs to another user", () => {
    it("Then it should respond 404 QUOTE_NOT_FOUND", async () => {
      const { cookie } = createSessionCookie();
      const { id } = await addQuote(new Types.ObjectId().toString());

      const response = await request(app)
        .get(`/quotes/${id}`)
        .set("Cookie", cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("QUOTE_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get(
        `/quotes/${new Types.ObjectId().toString()}`,
      );

      expect(response.status).toBe(401);
    });
  });
});

describe("Given the PATCH /quotes/:id endpoint", () => {
  describe("When the user edits the text and removes the page", () => {
    it("Then it should respond 200 with the updated quote without page", async () => {
      const { cookie, userId } = createSessionCookie();
      const { id } = await addQuote(userId);

      const response = await patchQuote(cookie, id, {
        text: "Texto nuevo",
        page: null,
      });

      expect(response.status).toBe(200);
      expect(response.body.quote).toMatchObject({ id, text: "Texto nuevo" });
      expect(response.body.quote).not.toHaveProperty("page");
    });
  });

  describe("When the user edits the source of a quote without a book", () => {
    it("Then it should respond 200 with the new source", async () => {
      const { cookie, userId } = createSessionCookie();
      const stored = await Quote.create({ userId, text: "Suelta" });

      const response = await patchQuote(cookie, stored.id, {
        source: "Biblioteca de Triana",
      });

      expect(response.status).toBe(200);
      expect(response.body.quote).toMatchObject({
        source: "Biblioteca de Triana",
      });
      expect(response.body.quote).not.toHaveProperty("book");
    });
  });

  describe("When the user sends a source for a quote with a book", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field source", async () => {
      const { cookie, userId } = createSessionCookie();
      const { id } = await addQuote(userId);

      const response = await patchQuote(cookie, id, { source: "Paper" });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "source",
      });
    });
  });

  describe("When the text is null", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field text", async () => {
      const { cookie, userId } = createSessionCookie();
      const { id } = await addQuote(userId);

      const response = await patchQuote(cookie, id, { text: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "text",
      });
    });
  });

  describe("When the quote belongs to another user", () => {
    it("Then it should respond 404 QUOTE_NOT_FOUND", async () => {
      const { cookie } = createSessionCookie();
      const { id } = await addQuote(new Types.ObjectId().toString());

      const response = await patchQuote(cookie, id, { text: "Hack" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("QUOTE_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401", async () => {
      const response = await request(app)
        .patch(`/quotes/${new Types.ObjectId().toString()}`)
        .send({ text: "x" });

      expect(response.status).toBe(401);
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .patch(`/quotes/${new Types.ObjectId().toString()}`)
        .set("Cookie", cookie)
        .send({ text: "x" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });
});

describe("Given the DELETE /quotes/:id endpoint", () => {
  describe("When the quote belongs to the user", () => {
    it("Then it should respond 204 and remove it", async () => {
      const { cookie, userId } = createSessionCookie();
      const { id } = await addQuote(userId);

      const response = await request(app)
        .delete(`/quotes/${id}`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN);

      expect(response.status).toBe(204);
      expect(await Quote.findById(id)).toBeNull();
    });
  });

  describe("When the quote belongs to another user", () => {
    it("Then it should respond 404 QUOTE_NOT_FOUND and keep it", async () => {
      const { cookie } = createSessionCookie();
      const { id } = await addQuote(new Types.ObjectId().toString());

      const response = await request(app)
        .delete(`/quotes/${id}`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("QUOTE_NOT_FOUND");
      expect(await Quote.findById(id)).not.toBeNull();
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401", async () => {
      const response = await request(app).delete(
        `/quotes/${new Types.ObjectId().toString()}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .delete(`/quotes/${new Types.ObjectId().toString()}`)
        .set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });
});

describe("Given the GET /quotes/books endpoint", () => {
  describe("When the user has quotes", () => {
    it("Then it should respond 200 with { items } and not treat books as a quote id", async () => {
      const { cookie, userId } = createSessionCookie();
      const { book } = await addQuote(userId);

      const response = await request(app)
        .get("/quotes/books")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [{ bookId: book.id, title: book.title, count: 1 }],
        unlinkedCount: 0,
      });
    });
  });

  describe("When the user has quotes without a book", () => {
    it("Then it should report them in unlinkedCount", async () => {
      const { cookie } = createSessionCookie();
      await postQuote(cookie, buildCreateQuoteDto(undefined));
      await postQuote(cookie, buildCreateQuoteDto(undefined));

      const response = await request(app)
        .get("/quotes/books")
        .set("Cookie", cookie);

      expect(response.body).toEqual({ items: [], unlinkedCount: 2 });
    });
  });

  describe("When the user has no quotes", () => {
    it("Then it should respond 200 with an empty list", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/quotes/books")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], unlinkedCount: 0 });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401", async () => {
      const response = await request(app).get("/quotes/books");

      expect(response.status).toBe(401);
    });
  });
});
