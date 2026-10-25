import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

const sendVerificationEmailMock = jest
  .fn<(to: string, token: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: sendVerificationEmailMock,
  }),
);

const { default: app } = await import("../../../../server/app.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
  sendVerificationEmailMock.mockClear();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

describe("Given the POST /auth/register endpoint", () => {
  describe("When it receives valid registration data", () => {
    it("Then it should respond with status 201 and the user without sensitive fields", async () => {
      const dto = buildRegisterDto();

      const response = await request(app).post("/auth/register").send(dto);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          name: dto.name,
          email: dto.email,
          preferences: { libraryView: "grid" },
        },
      });
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it("Then it should set the accessToken, refreshToken and csrfToken cookies", async () => {
      const dto = buildRegisterDto();

      const response = await request(app).post("/auth/register").send(dto);

      const setCookieHeader = response.get("Set-Cookie");
      expect(setCookieHeader).toBeDefined();

      const cookieNames = setCookieHeader?.map(
        (cookie) => cookie.split("=")[0],
      );
      expect(cookieNames).toEqual(
        expect.arrayContaining(["accessToken", "refreshToken", "csrfToken"]),
      );
    });
  });

  describe("When it receives an email that is already registered", () => {
    it("Then it should respond with status 400 and AUTH_EMAIL_TAKEN", async () => {
      const dto = buildRegisterDto();
      await request(app).post("/auth/register").send(dto);

      const response = await request(app).post("/auth/register").send(dto);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "AUTH_EMAIL_TAKEN",
          message: expect.any(String),
          field: "email",
        },
      });
    });
  });

  describe("When it receives a weak password", () => {
    it("Then it should respond with status 400, AUTH_WEAK_PASSWORD and the password field", async () => {
      const dto = buildRegisterDto({ password: "weak" });

      const response = await request(app).post("/auth/register").send(dto);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "AUTH_WEAK_PASSWORD",
          message: expect.any(String),
          field: "password",
        },
      });
    });
  });

  describe("When it receives a body without acceptedTerms", () => {
    it("Then it should respond with status 400 and VALIDATION_ERROR", async () => {
      const dto = buildRegisterDto();
      const { acceptedTerms: _acceptedTerms, ...bodyWithoutTerms } = dto;

      const response = await request(app)
        .post("/auth/register")
        .send(bodyWithoutTerms);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
