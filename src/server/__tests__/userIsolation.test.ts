import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../test/memoryDatabase.js";
import getCookieValue from "../../test/getCookieValue.js";
import { buildCreateBookDto } from "../../domains/books/fixtures/books.fixtures.js";
import { buildCreateQuoteDto } from "../../domains/quotes/fixtures/quotes.fixtures.js";
import { buildRegisterDto } from "../../domains/auth/fixtures/auth.fixtures.js";

jest.unstable_mockModule("../../shared/email/sendVerificationEmail.js", () => ({
  default: jest
    .fn<(to: string, token: string) => Promise<void>>()
    .mockResolvedValue(undefined),
}));

const { default: app } = await import("../app.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const CSRF = "csrf-value";
const SECRET_QUOTE = "Frase privada de la primera usuaria";

interface Session {
  cookie: string;
  userId: string;
}

// Sesiones reales: se registran por la API y solo viaja la cookie que el
// servidor entrega, igual que en el navegador.
const registerUser = async (email: string): Promise<Session> => {
  const response = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto({ email }));

  return {
    userId: response.body.user.id,
    cookie: `accessToken=${getCookieValue(response, "accessToken")}; csrfToken=${CSRF}`,
  };
};

const withSession = (session: Session) => ({
  get: (url: string) => request(app).get(url).set("Cookie", session.cookie),
  post: (url: string, body: object) =>
    request(app)
      .post(url)
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", CSRF)
      .send(body),
});

const seedLibraryOf = async (session: Session) => {
  const api = withSession(session);
  const created = await api.post("/books", buildCreateBookDto());
  const quote = await api.post(
    "/quotes",
    buildCreateQuoteDto(created.body.ejemplar.id, { text: SECRET_QUOTE }),
  );
  await api.post("/quotes", { text: `${SECRET_QUOTE} (suelta)` });

  return {
    bookId: created.body.book.id as string,
    quoteId: quote.body.quote.id as string,
  };
};

describe("Given two registered users and a library that only the first one has filled", () => {
  describe("When the second user asks for their lists", () => {
    it.each([
      "/quotes",
      "/quotes?unlinked=true",
      "/quotes?sort=book",
      "/quotes/books",
      "/books",
      "/books/tags",
      "/stats",
      "/auth/me",
      "/auth/me/export",
    ])(
      "Then GET %s should not carry anything of the first user",
      async (url) => {
        const first = await registerUser("primera@example.com");
        const second = await registerUser("segunda@example.com");
        const { bookId } = await seedLibraryOf(first);

        const response = await withSession(second).get(url);

        expect(response.status).toBe(200);
        expect(response.text).not.toContain(SECRET_QUOTE);
        expect(response.text).not.toContain(bookId);
        expect(response.text).not.toContain("primera@example.com");
      },
    );

    it("Then their feeds should be empty and their numbers zero", async () => {
      const first = await registerUser("primera@example.com");
      const second = await registerUser("segunda@example.com");
      await seedLibraryOf(first);
      const api = withSession(second);

      const quotes = await api.get("/quotes");
      const books = await api.get("/books");
      const stats = await api.get("/stats");

      expect(quotes.body).toEqual({ items: [], nextCursor: null, total: 0 });
      expect(books.body).toEqual({ items: [], nextCursor: null, total: 0 });
      expect(stats.body).toEqual({ books: 0, quotes: 0, favorites: 0 });
    });
  });

  describe("When the second user asks for something of the first one by id", () => {
    it("Then it should answer 404 and reveal nothing", async () => {
      const first = await registerUser("primera@example.com");
      const second = await registerUser("segunda@example.com");
      const { bookId, quoteId } = await seedLibraryOf(first);
      const api = withSession(second);

      const book = await api.get(`/books/${bookId}`);
      const quote = await api.get(`/quotes/${quoteId}`);
      const bookQuotes = await api.get(`/quotes?bookId=${bookId}`);

      expect(book.status).toBe(404);
      expect(quote.status).toBe(404);
      expect(bookQuotes.status).toBe(404);
      expect(quote.text).not.toContain(SECRET_QUOTE);
    });
  });

  describe("When the first user still sees their own data", () => {
    it("Then their lists should keep it, so the empty answers above are not an artifact", async () => {
      const first = await registerUser("primera@example.com");
      await registerUser("segunda@example.com");
      await seedLibraryOf(first);

      const quotes = await withSession(first).get("/quotes");

      expect(quotes.body.total).toBe(2);
      expect(quotes.text).toContain(SECRET_QUOTE);
    });
  });
});
