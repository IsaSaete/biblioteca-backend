import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import {
  buildJpegBuffer,
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

const uploadAvatar = (cookie: string, body: Buffer) =>
  request(app)
    .put("/auth/me/avatar")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .set("Content-Type", "image/jpeg")
    .send(body);

const deleteAvatar = (cookie: string) =>
  request(app)
    .delete("/auth/me/avatar")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF);

describe("Given the DELETE /auth/me/avatar endpoint", () => {
  describe("When a logged-in user has a photo", () => {
    it("Then it should respond 204 and the photo should be gone", async () => {
      const cookie = await registerSession();
      await uploadAvatar(cookie, buildJpegBuffer());

      const response = await deleteAvatar(cookie);
      const me = await request(app).get("/auth/me").set("Cookie", cookie);
      const avatar = await request(app)
        .get("/auth/me/avatar")
        .set("Cookie", cookie);

      expect(response.status).toBe(204);
      expect(me.body.user.avatarUrl).toBeNull();
      expect(avatar.status).toBe(404);
    });
  });

  describe("When the user has no photo", () => {
    it("Then it should also respond 204", async () => {
      const cookie = await registerSession();

      const response = await deleteAvatar(cookie);

      expect(response.status).toBe(204);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .delete("/auth/me/avatar")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and keep the photo", async () => {
      const cookie = await registerSession();
      await uploadAvatar(cookie, buildJpegBuffer());

      const response = await request(app)
        .delete("/auth/me/avatar")
        .set("Cookie", cookie);
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.body.user.avatarUrl).not.toBeNull();
    });
  });
});
