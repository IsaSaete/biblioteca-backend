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

const registerSession = async (): Promise<string> => {
  const register = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto());

  return `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`;
};

const patchProfile = (cookie: string, body: object) =>
  request(app)
    .patch("/auth/me")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send(body);

describe("Given the PATCH /auth/me endpoint", () => {
  describe("When a logged-in user sends a new name", () => {
    it("Then it should respond 200 with { user } and GET /auth/me should show it", async () => {
      const cookie = await registerSession();

      const response = await patchProfile(cookie, { name: "Isabel" });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        name: "Isabel",
        email: "isa@example.com",
        avatarUrl: null,
      });
      expect(response.body.user).not.toHaveProperty("passwordHash");
      expect(me.body.user.name).toBe("Isabel");
    });
  });

  describe("When the name is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field name", async () => {
      const cookie = await registerSession();

      const response = await patchProfile(cookie, { name: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "name",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .patch("/auth/me")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .send({ name: "Isabel" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and not change the name", async () => {
      const cookie = await registerSession();

      const response = await request(app)
        .patch("/auth/me")
        .set("Cookie", cookie)
        .send({ name: "Isabel" });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.body.user.name).toBe("Isa");
    });
  });
});
