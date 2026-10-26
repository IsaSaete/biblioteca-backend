import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
import { buildCreateQuoteDto } from "../../../quotes/fixtures/quotes.fixtures.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const { default: BooksService } =
  await import("../../../books/service/BooksService.js");
const { default: QuotesService } =
  await import("../../../quotes/service/QuotesService.js");
const { default: app } = await import("../../../../server/app.js");

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

const registerWithData = async () => {
  const register = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto());
  const userId: string = register.body.user.id;
  const { ejemplar } = await BooksService.createBook(
    userId,
    buildCreateBookDto(),
  );
  await QuotesService.createQuote(userId, buildCreateQuoteDto(ejemplar.id));

  return {
    userId,
    cookie: `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`,
  };
};

describe("Given the GET /auth/me/export endpoint", () => {
  describe("When a logged-in user asks for their data", () => {
    it("Then it should respond 200 with a JSON attachment in the contract shape", async () => {
      const { cookie, userId } = await registerWithData();

      const response = await request(app)
        .get("/auth/me/export")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.headers["content-disposition"]).toBe(
        'attachment; filename="glosa-datos.json"',
      );
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(JSON.parse(response.text)).toEqual({
        exportedAt: expect.any(String),
        user: {
          id: userId,
          name: "Isa",
          email: "isa@example.com",
          createdAt: expect.any(String),
        },
        books: [{ book: expect.any(Object), ejemplar: expect.any(Object) }],
        quotes: [expect.objectContaining({ page: 9 })],
      });
    });

    it("Then the body should not contain hashes or tokens", async () => {
      const { cookie } = await registerWithData();

      const response = await request(app)
        .get("/auth/me/export")
        .set("Cookie", cookie);

      expect(response.text).not.toMatch(
        /passwordHash|TokenHash|refreshToken|avatar/,
      );
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/auth/me/export");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
