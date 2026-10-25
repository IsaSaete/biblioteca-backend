import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import createSessionCookie, {
  CSRF_TOKEN,
} from "../../../../test/createSessionCookie.js";
import app from "../../../../server/app.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import { LIBRARY_PAGE_SIZE } from "../../service/BooksService.js";
import {
  OTHER_EDITION_ISBN_13,
  buildCreateBookDto,
  buildManualBookDto,
} from "../../fixtures/books.fixtures.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const postBook = (cookie: string, body: unknown) =>
  request(app)
    .post("/books")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body as object);

describe("Given the POST /books endpoint", () => {
  describe("When a logged-in user sends a complete book", () => {
    it("Then it should respond 201 with { book, ejemplar } and a pending Ejemplar", async () => {
      const { cookie } = createSessionCookie();
      const dto = buildCreateBookDto({ status: undefined });

      const response = await postBook(cookie, dto);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        book: {
          id: expect.any(String),
          isbn: dto.isbn,
          title: dto.title,
          authors: dto.authors,
          publisher: dto.publisher,
          publishedYear: dto.publishedYear,
          pageCount: dto.pageCount,
          language: dto.language,
          coverUrl: dto.coverUrl,
          coverSource: "google_books",
          synopsis: dto.synopsis,
          categories: dto.categories,
        },
        ejemplar: {
          id: expect.any(String),
          bookId: response.body.book.id,
          status: "pending",
          favorite: false,
          createdAt: expect.any(String),
        },
      });
    });
  });

  describe("When the body tries to set the owner", () => {
    it("Then the Ejemplar should belong to the session user, not to the body's", async () => {
      const { cookie, userId } = createSessionCookie();

      const response = await postBook(cookie, {
        ...buildCreateBookDto(),
        userId: "000000000000000000000000",
      });

      expect(response.status).toBe(201);
      const stored = await Ejemplar.findById(response.body.ejemplar.id);
      expect(stored?.userId.toString()).toBe(userId);
    });
  });

  describe("When a manual book without ISBN, cover or optional data is sent", () => {
    it("Then it should respond 201 omitting the missing fields", async () => {
      const { cookie } = createSessionCookie();

      const response = await postBook(cookie, buildManualBookDto());

      expect(response.status).toBe(201);
      expect(response.body.book).toEqual({
        id: expect.any(String),
        title: "Apuntes de un viaje",
        authors: ["Autora Anónima"],
        publisher: "Edición del autor",
      });
    });
  });

  describe("When the user already has that book", () => {
    it("Then it should respond 409 with BOOK_ALREADY_IN_LIBRARY", async () => {
      const { cookie } = createSessionCookie();
      await postBook(cookie, buildCreateBookDto());

      const response = await postBook(cookie, buildCreateBookDto());

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: { code: "BOOK_ALREADY_IN_LIBRARY", message: expect.any(String) },
      });
    });
  });

  describe("When the user adds another edition with a different ISBN", () => {
    it("Then it should respond 201", async () => {
      const { cookie } = createSessionCookie();
      await postBook(cookie, buildCreateBookDto());

      const response = await postBook(
        cookie,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13 }),
      );

      expect(response.status).toBe(201);
    });
  });

  describe("When the ISBN is invalid", () => {
    it("Then it should respond 400 with INVALID_ISBN and field isbn", async () => {
      const { cookie } = createSessionCookie();

      const response = await postBook(
        cookie,
        buildCreateBookDto({ isbn: "123" }),
      );

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

  describe("When the body sends a single author instead of the authors list", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on authors", async () => {
      const { cookie } = createSessionCookie();
      const { authors: _authors, ...body } = buildCreateBookDto();

      const response = await postBook(cookie, { ...body, author: "Alguien" });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "authors",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/books")
        .send(buildCreateBookDto());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 with CSRF_INVALID and save nothing", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .post("/books")
        .set("Cookie", cookie)
        .send(buildCreateBookDto());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(await Book.countDocuments()).toBe(0);
    });
  });
});

describe("Given the GET /books endpoint", () => {
  describe("When the user has books", () => {
    it("Then it should respond 200 with { items: [{ book, ejemplar }], nextCursor: null, total: 1 }", async () => {
      const { cookie } = createSessionCookie();
      await postBook(cookie, buildCreateBookDto());

      const response = await request(app).get("/books").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [
          {
            book: expect.objectContaining({ title: "La sombra del viento" }),
            ejemplar: expect.objectContaining({ status: "pending" }),
          },
        ],
        nextCursor: null,
        total: 1,
      });
    });
  });

  describe("When the user filters and the total is requested", () => {
    it("Then total should count all the matching books, not only the page", async () => {
      const { cookie, userId } = createSessionCookie();
      await Ejemplar.insertMany(
        await Promise.all(
          Array.from({ length: LIBRARY_PAGE_SIZE + 1 }, async (_, index) => {
            const book = await Book.create(
              buildManualBookDto({ title: `Favorito ${index}` }),
            );

            return { userId, bookId: book._id, favorite: true };
          }),
        ),
      );

      const response = await request(app)
        .get("/books")
        .query({ favorite: "true" })
        .set("Cookie", cookie);

      expect(response.body.items).toHaveLength(LIBRARY_PAGE_SIZE);
      expect(response.body.total).toBe(LIBRARY_PAGE_SIZE + 1);
    });
  });

  describe("When two users share the same Book", () => {
    it("Then each one should only see their own Ejemplar", async () => {
      const userA = createSessionCookie();
      const userB = createSessionCookie();
      await postBook(userA.cookie, buildCreateBookDto({ status: "read" }));
      await postBook(userB.cookie, buildCreateBookDto({ status: "reading" }));

      const response = await request(app)
        .get("/books")
        .set("Cookie", userA.cookie);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].ejemplar.status).toBe("read");
    });
  });

  describe("When the library exceeds one page", () => {
    it("Then it should return 24 books and a nextCursor that serves the rest", async () => {
      const { cookie } = createSessionCookie();
      for (let index = 0; index <= LIBRARY_PAGE_SIZE; index += 1) {
        await postBook(cookie, buildManualBookDto({ title: `Libro ${index}` }));
      }

      const first = await request(app).get("/books").set("Cookie", cookie);
      const second = await request(app)
        .get("/books")
        .query({ cursor: first.body.nextCursor })
        .set("Cookie", cookie);

      expect(first.body.items).toHaveLength(LIBRARY_PAGE_SIZE);
      expect(typeof first.body.nextCursor).toBe("string");
      expect(second.body.items).toHaveLength(1);
      expect(second.body.nextCursor).toBeNull();
    });
  });

  describe("When the cursor is invalid", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on cursor", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books")
        .query({ cursor: "basura" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "cursor",
      });
    });
  });

  describe("When the sort is oldest", () => {
    it("Then it should respond 200 with the first added book first", async () => {
      const { cookie } = createSessionCookie();
      await postBook(cookie, buildManualBookDto({ title: "Primero" }));
      await postBook(cookie, buildManualBookDto({ title: "Segundo" }));

      const response = await request(app)
        .get("/books")
        .query({ sort: "oldest" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map(
          (item: { book: { title: string } }) => item.book.title,
        ),
      ).toEqual(["Primero", "Segundo"]);
    });
  });

  describe("When the user searches by a word of the title or author", () => {
    it("Then it should respond 200 with only the matching books", async () => {
      const { cookie } = createSessionCookie();
      await postBook(
        cookie,
        buildManualBookDto({ title: "Cien años de soledad" }),
      );
      await postBook(cookie, buildManualBookDto({ title: "Ficciones" }));

      const response = await request(app)
        .get("/books")
        .query({ search: "ANOS" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map(
          (item: { book: { title: string } }) => item.book.title,
        ),
      ).toEqual(["Cien años de soledad"]);
      expect(response.body.nextCursor).toBeNull();
    });
  });

  describe("When the user filters by favorite=true", () => {
    it("Then it should respond 200 with only their favorite books", async () => {
      const { cookie } = createSessionCookie();
      const favorite = await postBook(
        cookie,
        buildManualBookDto({ title: "Favorito" }),
      );
      await postBook(cookie, buildManualBookDto({ title: "Normal" }));
      await request(app)
        .patch(`/books/${favorite.body.book.id}/ejemplar`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send({ favorite: true });

      const response = await request(app)
        .get("/books")
        .query({ favorite: "true" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map(
          (item: { book: { title: string } }) => item.book.title,
        ),
      ).toEqual(["Favorito"]);
    });
  });

  describe("When the user filters by a tag", () => {
    it("Then it should respond 200 with only the books that have it", async () => {
      const { cookie } = createSessionCookie();
      const tagged = await postBook(
        cookie,
        buildManualBookDto({ title: "Etiquetado" }),
      );
      await postBook(cookie, buildManualBookDto({ title: "Sin etiqueta" }));
      await request(app)
        .patch(`/books/${tagged.body.book.id}/ejemplar`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send({ tags: ["Historia"] });

      const response = await request(app)
        .get("/books")
        .query({ tag: "historia" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map(
          (item: { book: { title: string } }) => item.book.title,
        ),
      ).toEqual(["Etiquetado"]);
    });
  });

  describe("When the user filters by untagged=true", () => {
    it("Then it should respond 200 with only the books without tags", async () => {
      const { cookie } = createSessionCookie();
      const tagged = await postBook(
        cookie,
        buildManualBookDto({ title: "Etiquetado" }),
      );
      await postBook(cookie, buildManualBookDto({ title: "Sin catalogar" }));
      await request(app)
        .patch(`/books/${tagged.body.book.id}/ejemplar`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send({ tags: ["Historia"] });

      const response = await request(app)
        .get("/books")
        .query({ untagged: "true" })
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(
        response.body.items.map(
          (item: { book: { title: string } }) => item.book.title,
        ),
      ).toEqual(["Sin catalogar"]);
    });
  });

  describe("When untagged is combined with tag", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on untagged", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books")
        .query({ untagged: "true", tag: "Historia" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "untagged",
      });
    });
  });

  describe("When favorite has an unknown value", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on favorite", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books")
        .query({ favorite: "quizás" })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "favorite",
      });
    });
  });

  describe("When the search is too long", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on search", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books")
        .query({ search: "a".repeat(101) })
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "search",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/books");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});

describe("Given the GET /books/:id endpoint", () => {
  describe("When the user has that book", () => {
    it("Then it should respond 200 with { book, ejemplar }", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());

      const response = await request(app)
        .get(`/books/${created.body.book.id}`)
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        book: created.body.book,
        ejemplar: created.body.ejemplar,
      });
    });
  });

  describe("When the book belongs to another user", () => {
    it("Then it should respond 404 with BOOK_NOT_FOUND", async () => {
      const owner = createSessionCookie();
      const other = createSessionCookie();
      const created = await postBook(owner.cookie, buildCreateBookDto());

      const response = await request(app)
        .get(`/books/${created.body.book.id}`)
        .set("Cookie", other.cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
    });
  });

  describe("When the id is malformed", () => {
    it("Then it should respond 404 with BOOK_NOT_FOUND", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/no-es-un-id")
        .set("Cookie", cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get(
        "/books/64b7f0c2a1b2c3d4e5f60718",
      );

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});

const patchEjemplar = (cookie: string, bookId: string, body: unknown) =>
  request(app)
    .patch(`/books/${bookId}/ejemplar`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body as object);

describe("Given the PATCH /books/:id/ejemplar endpoint", () => {
  describe("When the user edits their personal data", () => {
    it("Then it should respond 200 with { ejemplar } and GET should return it", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());
      const bookId = created.body.book.id;

      const response = await patchEjemplar(cookie, bookId, {
        favorite: true,
        notes: "Releer en verano",
        tags: ["novela"],
        overrides: { title: "Mi edición" },
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ejemplar: {
          id: created.body.ejemplar.id,
          bookId,
          status: "pending",
          favorite: true,
          notes: "Releer en verano",
          tags: ["novela"],
          overrides: { title: "Mi edición" },
          createdAt: created.body.ejemplar.createdAt,
        },
      });

      const detail = await request(app)
        .get(`/books/${bookId}`)
        .set("Cookie", cookie);
      expect(detail.body.ejemplar).toEqual(response.body.ejemplar);
      expect(detail.body.book).toEqual(created.body.book);
    });
  });

  describe("When the body has more than 5 tags", () => {
    it("Then it should respond 400 with TAG_LIMIT_EXCEEDED", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());

      const response = await patchEjemplar(cookie, created.body.book.id, {
        tags: ["a", "b", "c", "d", "e", "f"],
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("TAG_LIMIT_EXCEEDED");
    });
  });

  describe("When the format is not valid", () => {
    it("Then it should respond 400 with VALIDATION_ERROR on format", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());

      const response = await patchEjemplar(cookie, created.body.book.id, {
        format: "ebook",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "format",
      });
    });
  });

  describe("When the book belongs to another user", () => {
    it("Then it should respond 404 with BOOK_NOT_FOUND and not change it", async () => {
      const owner = createSessionCookie();
      const other = createSessionCookie();
      const created = await postBook(owner.cookie, buildCreateBookDto());
      const bookId = created.body.book.id;

      const response = await patchEjemplar(other.cookie, bookId, {
        favorite: true,
      });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
      const detail = await request(app)
        .get(`/books/${bookId}`)
        .set("Cookie", owner.cookie);
      expect(detail.body.ejemplar.favorite).toBe(false);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .patch("/books/64b7f0c2a1b2c3d4e5f60718/ejemplar")
        .send({ favorite: true });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 with CSRF_INVALID", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());

      const response = await request(app)
        .patch(`/books/${created.body.book.id}/ejemplar`)
        .set("Cookie", cookie)
        .send({ favorite: true });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });
});

const deleteBook = (cookie: string, bookId: string) =>
  request(app)
    .delete(`/books/${bookId}`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN);

describe("Given the DELETE /books/:id endpoint", () => {
  describe("When the user deletes a book of their library", () => {
    it("Then it should respond 204 and the book should leave their library", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());
      const bookId = created.body.book.id;

      const response = await deleteBook(cookie, bookId);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      const detail = await request(app)
        .get(`/books/${bookId}`)
        .set("Cookie", cookie);
      expect(detail.status).toBe(404);
      const library = await request(app).get("/books").set("Cookie", cookie);
      expect(library.body.items).toEqual([]);
    });
  });

  describe("When another user also has that book", () => {
    it("Then it should keep it in the other user's library", async () => {
      const userA = createSessionCookie();
      const userB = createSessionCookie();
      const created = await postBook(userA.cookie, buildCreateBookDto());
      await postBook(userB.cookie, buildCreateBookDto());

      await deleteBook(userA.cookie, created.body.book.id);

      const library = await request(app)
        .get("/books")
        .set("Cookie", userB.cookie);
      expect(library.body.items).toHaveLength(1);
    });
  });

  describe("When the book is not in the user's library", () => {
    it("Then it should respond 404 with BOOK_NOT_FOUND", async () => {
      const owner = createSessionCookie();
      const other = createSessionCookie();
      const created = await postBook(owner.cookie, buildCreateBookDto());

      const response = await deleteBook(other.cookie, created.body.book.id);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("BOOK_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).delete(
        "/books/64b7f0c2a1b2c3d4e5f60718",
      );

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 with CSRF_INVALID and keep the book", async () => {
      const { cookie } = createSessionCookie();
      const created = await postBook(cookie, buildCreateBookDto());

      const response = await request(app)
        .delete(`/books/${created.body.book.id}`)
        .set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      const library = await request(app).get("/books").set("Cookie", cookie);
      expect(library.body.items).toHaveLength(1);
    });
  });
});

describe("Given the GET /books/tags endpoint", () => {
  describe("When the user has tagged and untagged books", () => {
    it("Then it should respond 200 with { items, untaggedCount }, without treating tags as a book id", async () => {
      const { cookie } = createSessionCookie();
      const tagged = await postBook(
        cookie,
        buildManualBookDto({ title: "Etiquetado" }),
      );
      await postBook(cookie, buildManualBookDto({ title: "Sin etiquetas" }));
      await request(app)
        .patch(`/books/${tagged.body.book.id}/ejemplar`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send({ tags: ["Historia"] });

      const response = await request(app)
        .get("/books/tags")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [{ tag: "Historia", count: 1 }],
        untaggedCount: 1,
      });
    });
  });

  describe("When the user has no books", () => {
    it("Then it should respond 200 with an empty list", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/books/tags")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], untaggedCount: 0 });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/books/tags");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
