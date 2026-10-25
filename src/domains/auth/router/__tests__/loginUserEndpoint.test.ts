import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import {
  buildLoginDto,
  buildRegisterDto,
} from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const { default: app } = await import("../../../../server/app.js");
const { default: User } = await import("../../model/User.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

describe("Given the POST /auth/login endpoint", () => {
  beforeEach(async () => {
    await request(app).post("/auth/register").send(buildRegisterDto());
  });

  describe("When it receives valid credentials", () => {
    it("Then it should respond 200 with the user without sensitive fields", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send(buildLoginDto());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          name: "Isa",
          email: "isa@example.com",
          preferences: { libraryView: "grid" },
        },
      });
    });

    it("Then it should set the accessToken, refreshToken and csrfToken cookies with the contract attributes", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send(buildLoginDto());

      const cookies = response.get("Set-Cookie") ?? [];
      const byName = (name: string) =>
        cookies.find((cookie) => cookie.startsWith(`${name}=`)) ?? "";
      expect(byName("accessToken")).toMatch(/HttpOnly/);
      expect(byName("accessToken")).toMatch(/Secure/);
      expect(byName("accessToken")).toMatch(/SameSite=None/);
      expect(byName("refreshToken")).toMatch(/HttpOnly/);
      expect(byName("refreshToken")).toMatch(/Path=\/auth\/refresh/);
      expect(byName("csrfToken")).not.toMatch(/HttpOnly/);
      expect(byName("csrfToken")).toMatch(/SameSite=None/);
    });

    it("Then it should store only the hash of the refresh token", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send(buildLoginDto());

      const storedUser = await User.findOne({ email: "isa@example.com" });
      const refreshToken = getCookieValue(response, "refreshToken");
      expect(storedUser?.refreshTokenHash).toEqual(expect.any(String));
      expect(storedUser?.refreshTokenHash).not.toBe(refreshToken);
    });
  });

  describe("When it receives a wrong password", () => {
    it("Then it should respond 401 with AUTH_INVALID_CREDENTIALS and no cookies", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send(buildLoginDto({ password: "Wr0ng!Password" }));

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "AUTH_INVALID_CREDENTIALS",
          message: expect.any(String),
        },
      });
      expect(response.get("Set-Cookie")).toBeUndefined();
    });
  });

  describe("When it receives an email that is not registered", () => {
    it("Then it should respond with the same body as a wrong password", async () => {
      const wrongPassword = await request(app)
        .post("/auth/login")
        .send(buildLoginDto({ password: "Wr0ng!Password" }));

      const unknownEmail = await request(app)
        .post("/auth/login")
        .send(buildLoginDto({ email: "nobody@example.com" }));

      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });
  });

  describe("When it receives a body without email", () => {
    it("Then it should respond 400 with VALIDATION_ERROR and the email field", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({ password: "Str0ng!Pass" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: expect.any(String),
          field: "email",
        },
      });
    });
  });
});
