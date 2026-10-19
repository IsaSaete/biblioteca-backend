import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
  NEW_VALID_PASSWORD,
  buildRegisterDto,
} from "../../fixtures/auth.fixtures.js";

const sendPasswordResetEmailMock = jest
  .fn<(to: string, token: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);
jest.unstable_mockModule(
  "../../../../shared/email/sendPasswordResetEmail.js",
  () => ({ default: sendPasswordResetEmailMock }),
);

const { default: app } = await import("../../../../server/app.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
  sendPasswordResetEmailMock.mockClear();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

describe("Given the POST /auth/forgot-password endpoint", () => {
  describe("When it receives the email of a registered user", () => {
    it("Then it should respond 200 and send the email", async () => {
      await request(app).post("/auth/register").send(buildRegisterDto());

      const response = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "isa@example.com" });

      expect(response.status).toBe(200);
      expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("When it receives an email that is not registered", () => {
    it("Then it should respond exactly like for a registered one, without sending email", async () => {
      await request(app).post("/auth/register").send(buildRegisterDto());
      const registered = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "isa@example.com" });
      sendPasswordResetEmailMock.mockClear();

      const unknown = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "nobody@example.com" });

      expect(unknown.status).toBe(registered.status);
      expect(unknown.body).toEqual(registered.body);
      expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    });
  });

  describe("When it receives an invalid email", () => {
    it("Then it should respond 400 with VALIDATION_ERROR and the email field", async () => {
      const response = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "nope" });

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

describe("Given the POST /auth/reset-password endpoint", () => {
  const requestToken = async (): Promise<string> => {
    await request(app).post("/auth/register").send(buildRegisterDto());
    await request(app)
      .post("/auth/forgot-password")
      .send({ email: "isa@example.com" });
    const [, token] = sendPasswordResetEmailMock.mock.calls[0] as [
      string,
      string,
    ];
    return token;
  };

  describe("When it receives a valid token and a strong password", () => {
    it("Then it should respond 200 and let the user log in with the new password", async () => {
      const token = await requestToken();

      const response = await request(app)
        .post("/auth/reset-password")
        .send({ token, newPassword: NEW_VALID_PASSWORD });

      expect(response.status).toBe(200);
      const login = await request(app)
        .post("/auth/login")
        .send({ email: "isa@example.com", password: NEW_VALID_PASSWORD });
      expect(login.status).toBe(200);
    });
  });

  describe("When it receives an invalid or already used token", () => {
    it("Then it should respond 400 with AUTH_INVALID_TOKEN", async () => {
      const response = await request(app)
        .post("/auth/reset-password")
        .send({ token: "unknown", newPassword: NEW_VALID_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: { code: "AUTH_INVALID_TOKEN", message: expect.any(String) },
      });
    });
  });

  describe("When it receives a weak password", () => {
    it("Then it should respond 400 with AUTH_WEAK_PASSWORD and the newPassword field", async () => {
      const token = await requestToken();

      const response = await request(app)
        .post("/auth/reset-password")
        .send({ token, newPassword: "weak" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "AUTH_WEAK_PASSWORD",
          message: expect.any(String),
          field: "newPassword",
        },
      });
    });
  });
});
