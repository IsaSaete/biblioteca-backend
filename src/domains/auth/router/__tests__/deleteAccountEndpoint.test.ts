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
import {
  buildRegisterDto,
  validRegisterDto,
} from "../../fixtures/auth.fixtures.js";

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
    cookie: `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`,
  };
};

const deleteAccount = (cookie: string, body: object) =>
  request(app)
    .delete("/auth/me")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send(body);

describe("Given the DELETE /auth/me endpoint", () => {
  describe("When a logged-in user sends the right password", () => {
    it("Then it should respond 204, clear the session cookies and remove their data", async () => {
      const { cookie } = await registerWithData();

      const response = await deleteAccount(cookie, {
        password: validRegisterDto.password,
      });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);
      const login = await request(app).post("/auth/login").send({
        email: validRegisterDto.email,
        password: validRegisterDto.password,
      });

      expect(response.status).toBe(204);
      const cookies = response.get("Set-Cookie") ?? [];
      for (const name of ["accessToken", "refreshToken", "csrfToken"]) {
        const cleared = cookies.find((item) => item.startsWith(`${name}=;`));
        expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
      }
      expect(me.status).toBe(401);
      expect(login.status).toBe(401);
    });
  });

  describe("When the password is wrong", () => {
    it("Then it should respond 401 AUTH_INVALID_CREDENTIALS and keep the account", async () => {
      const { cookie } = await registerWithData();

      const response = await deleteAccount(cookie, {
        password: "Wr0ng!Password",
      });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
      expect(me.status).toBe(200);
    });
  });

  describe("When the password is missing", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field password", async () => {
      const { cookie } = await registerWithData();

      const response = await deleteAccount(cookie, {});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "password",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .delete("/auth/me")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .send({ password: validRegisterDto.password });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and keep the account", async () => {
      const { cookie } = await registerWithData();

      const response = await request(app)
        .delete("/auth/me")
        .set("Cookie", cookie)
        .send({ password: validRegisterDto.password });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.status).toBe(200);
    });
  });
});
