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

const patchPreferences = (cookie: string, body: object) =>
  request(app)
    .patch("/auth/me/preferences")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send(body);

describe("Given the PATCH /auth/me/preferences endpoint", () => {
  describe("When a logged-in user chooses the list view", () => {
    it("Then it should respond 200 with { preferences } and GET /auth/me should show it", async () => {
      const cookie = await registerSession();

      const response = await patchPreferences(cookie, { libraryView: "list" });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ preferences: { libraryView: "list" } });
      expect(me.body.user.preferences).toEqual({ libraryView: "list" });
    });
  });

  describe("When the body is empty", () => {
    it("Then it should respond 200 with the current preferences", async () => {
      const cookie = await registerSession();

      const response = await patchPreferences(cookie, {});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ preferences: { libraryView: "grid" } });
    });
  });

  describe("When the view is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field libraryView", async () => {
      const cookie = await registerSession();

      const response = await patchPreferences(cookie, { libraryView: "tabla" });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "libraryView",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .patch("/auth/me/preferences")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .send({ libraryView: "list" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and not change the view", async () => {
      const cookie = await registerSession();

      const response = await request(app)
        .patch("/auth/me/preferences")
        .set("Cookie", cookie)
        .send({ libraryView: "list" });
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.body.user.preferences).toEqual({ libraryView: "grid" });
    });
  });
});
