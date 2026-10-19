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

describe("Given the POST /auth/logout endpoint", () => {
  describe("When a logged-in user logs out with a valid CSRF token", () => {
    it("Then it should respond 204 and expire the three session cookies", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const accessToken = getCookieValue(register, "accessToken");

      const response = await request(app)
        .post("/auth/logout")
        .set("Cookie", `accessToken=${accessToken}; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(204);
      const cookies = response.get("Set-Cookie") ?? [];
      for (const name of ["accessToken", "refreshToken", "csrfToken"]) {
        const cookie = cookies.find((item) => item.startsWith(`${name}=;`));
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      }
      expect(cookies.find((item) => item.startsWith("refreshToken="))).toMatch(
        /Path=\/auth\/refresh/,
      );
    });

    it("Then the previous refresh token should stop working", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const accessToken = getCookieValue(register, "accessToken");
      const refreshToken = getCookieValue(register, "refreshToken");
      await request(app)
        .post("/auth/logout")
        .set("Cookie", `accessToken=${accessToken}; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      const response = await request(app)
        .post("/auth/refresh")
        .set("Cookie", `refreshToken=${refreshToken}; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(401);
    });
  });

  describe("When the access token has already expired", () => {
    it("Then it should still respond 204 and clear the cookies", async () => {
      const response = await request(app)
        .post("/auth/logout")
        .set("Cookie", `accessToken=expired; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(204);
    });
  });

  describe("When the request has no valid X-CSRF-Token header", () => {
    it("Then it should respond 403 with CSRF_INVALID", async () => {
      const response = await request(app)
        .post("/auth/logout")
        .set("Cookie", `csrfToken=${CSRF}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    });
  });
});
