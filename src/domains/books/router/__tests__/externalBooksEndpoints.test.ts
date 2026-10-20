import { jest } from "@jest/globals";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import createSessionCookie from "../../../../test/createSessionCookie.js";
import handleError from "../../../../middleware/handleError.js";
import createExternalBooksService from "../../service/ExternalBooksService.js";
import { createBooksRouter } from "../booksRouter.js";
import {
  ISBN_13,
  buildExternalBook,
  buildFakeProvider,
} from "../../fixtures/books.fixtures.js";
import type { BookProvider } from "../../provider/BookProvider.js";

// App mínima con proveedores falsos: ningún test sale a internet.
const buildApp = (...providers: BookProvider[]) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/books", createBooksRouter(createExternalBooksService(providers)));
  app.use(handleError);

  return app;
};

const book = buildExternalBook();

describe("Given the GET /books/lookup-isbn endpoint", () => {
  describe("When a provider knows the ISBN", () => {
    it("Then it should respond 200 with { book } and no id", async () => {
      const app = buildApp(buildFakeProvider("google_books", { book }));
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/lookup-isbn")
        .query({ isbn: "978-0-306-40615-7" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ book });
    });
  });

  describe("When the ISBN is invalid", () => {
    it("Then it should respond 400 with INVALID_ISBN and field isbn", async () => {
      const app = buildApp(buildFakeProvider("google_books", { book }));
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/lookup-isbn")
        .query({ isbn: "123" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "INVALID_ISBN",
          message: expect.any(String),
          field: "isbn",
        },
      });
    });
  });

  describe("When no provider knows the ISBN", () => {
    it("Then it should respond 404 with ISBN_NOT_FOUND", async () => {
      const app = buildApp(buildFakeProvider("google_books"));
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/lookup-isbn")
        .query({ isbn: ISBN_13 })
        .set("Cookie", cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ISBN_NOT_FOUND");
    });
  });

  describe("When a provider fails and the other does not find the book", () => {
    it("Then it should respond 502 with BOOK_PROVIDER_UNAVAILABLE", async () => {
      const app = buildApp(
        buildFakeProvider("google_books", { failing: true }),
        buildFakeProvider("open_library"),
      );
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/lookup-isbn")
        .query({ isbn: ISBN_13 })
        .set("Cookie", cookie);

      expect(response.status).toBe(502);
      expect(response.body.error.code).toBe("BOOK_PROVIDER_UNAVAILABLE");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 and never ask a provider", async () => {
      const provider = buildFakeProvider("google_books", { book });
      const findByIsbn = jest.spyOn(provider, "findByIsbn");
      const app = buildApp(provider);

      const response = await request(app)
        .get("/books/lookup-isbn")
        .query({ isbn: ISBN_13 });

      expect(response.status).toBe(401);
      expect(findByIsbn).not.toHaveBeenCalled();
    });
  });
});

describe("Given the GET /books/search-external endpoint", () => {
  describe("When the catalog has matches", () => {
    it("Then it should respond 200 with { results: [{ book }] }", async () => {
      const app = buildApp(
        buildFakeProvider("google_books", { results: [book] }),
      );
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/search-external")
        .query({ q: "sombra del viento" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ results: [{ book }] });
    });
  });

  describe("When nothing matches", () => {
    it("Then it should respond 200 with an empty results list", async () => {
      const app = buildApp(buildFakeProvider("google_books"));
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/search-external")
        .query({ q: "zzzz" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ results: [] });
    });
  });

  describe("When the search text is missing", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on q", async () => {
      const app = buildApp(buildFakeProvider("google_books"));
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/search-external")
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "q",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const app = buildApp(buildFakeProvider("google_books"));

      const response = await request(app)
        .get("/books/search-external")
        .query({ q: "sombra" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
