import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

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

const refreshWith = (refreshToken: string, csrf: string | undefined = CSRF) => {
  const req = request(app)
    .post("/auth/refresh")
    .set("Cookie", `refreshToken=${refreshToken}; csrfToken=${CSRF}`);

  return csrf ? req.set("X-CSRF-Token", csrf) : req;
};

describe("Given the POST /auth/refresh endpoint", () => {
  describe("When it receives the current refresh token", () => {
    it("Then it should respond 200 with a rotated refresh token and a new accessToken", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const refreshToken = getCookieValue(register, "refreshToken") ?? "";

      const response = await refreshWith(refreshToken);

      expect(response.status).toBe(200);
      expect(getCookieValue(response, "accessToken")).toEqual(
        expect.any(String),
      );
      expect(getCookieValue(response, "refreshToken")).toEqual(
        expect.any(String),
      );
      expect(getCookieValue(response, "refreshToken")).not.toBe(refreshToken);
      expect(getCookieValue(response, "csrfToken")).toBeUndefined();
    });
  });

  describe("When the old refresh token is used again after rotating", () => {
    it("Then it should respond 401 and revoke the whole session", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const oldToken = getCookieValue(register, "refreshToken") ?? "";
      const rotated = await refreshWith(oldToken);
      const newToken = getCookieValue(rotated, "refreshToken") ?? "";

      const reuse = await refreshWith(oldToken);
      const afterRevocation = await refreshWith(newToken);

      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe("AUTH_UNAUTHENTICATED");
      expect(afterRevocation.status).toBe(401);
    });
  });

  describe("When the request has no refresh token cookie", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { code: "AUTH_UNAUTHENTICATED", message: expect.any(String) },
      });
    });
  });

  describe("When the request has no valid X-CSRF-Token header", () => {
    it("Then it should respond 403 with CSRF_INVALID and not rotate the token", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const refreshToken = getCookieValue(register, "refreshToken") ?? "";

      const response = await refreshWith(refreshToken, "");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      const retry = await refreshWith(refreshToken);
      expect(retry.status).toBe(200);
    });
  });
});
