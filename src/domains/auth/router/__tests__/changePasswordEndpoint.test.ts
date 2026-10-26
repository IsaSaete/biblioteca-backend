import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import {
  NEW_VALID_PASSWORD,
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

const registerSession = async (): Promise<{
  cookie: string;
  refreshToken: string;
}> => {
  const register = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto());

  return {
    cookie: `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`,
    refreshToken: getCookieValue(register, "refreshToken") ?? "",
  };
};

const postPassword = (cookie: string, body: object) =>
  request(app)
    .post("/auth/me/password")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send(body);

const validBody = {
  currentPassword: validRegisterDto.password,
  newPassword: NEW_VALID_PASSWORD,
};

describe("Given the POST /auth/me/password endpoint", () => {
  describe("When a logged-in user sends the right current password and a valid new one", () => {
    it("Then it should respond 204 with new session cookies and the new password should log in", async () => {
      const { cookie, refreshToken } = await registerSession();

      const response = await postPassword(cookie, validBody);
      const login = await request(app).post("/auth/login").send({
        email: validRegisterDto.email,
        password: NEW_VALID_PASSWORD,
      });

      expect(response.status).toBe(204);
      expect(getCookieValue(response, "accessToken")).toBeDefined();
      expect(getCookieValue(response, "refreshToken")).toBeDefined();
      expect(getCookieValue(response, "refreshToken")).not.toBe(refreshToken);
      expect(login.status).toBe(200);
    });

    it("Then the refresh token of the other sessions should stop working", async () => {
      const { cookie, refreshToken } = await registerSession();

      await postPassword(cookie, validBody);
      const refresh = await request(app)
        .post("/auth/refresh")
        .set("Cookie", `refreshToken=${refreshToken}; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(refresh.status).toBe(401);
      expect(refresh.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the current password is wrong", () => {
    it("Then it should respond 401 AUTH_INVALID_CREDENTIALS and not change the password", async () => {
      const { cookie } = await registerSession();

      const response = await postPassword(cookie, {
        ...validBody,
        currentPassword: "Wr0ng!Password",
      });
      const login = await request(app).post("/auth/login").send({
        email: validRegisterDto.email,
        password: validRegisterDto.password,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
      expect(login.status).toBe(200);
    });
  });

  describe("When the new password is weak", () => {
    it("Then it should respond 400 AUTH_WEAK_PASSWORD with field newPassword", async () => {
      const { cookie } = await registerSession();

      const response = await postPassword(cookie, {
        ...validBody,
        newPassword: "corta",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "AUTH_WEAK_PASSWORD",
        field: "newPassword",
      });
    });
  });

  describe("When the current password is missing", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field currentPassword", async () => {
      const { cookie } = await registerSession();

      const response = await postPassword(cookie, {
        newPassword: NEW_VALID_PASSWORD,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "currentPassword",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/auth/me/password")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .send(validBody);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and not change the password", async () => {
      const { cookie } = await registerSession();

      const response = await request(app)
        .post("/auth/me/password")
        .set("Cookie", cookie)
        .send(validBody);
      const login = await request(app).post("/auth/login").send({
        email: validRegisterDto.email,
        password: validRegisterDto.password,
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(login.status).toBe(200);
    });
  });
});
