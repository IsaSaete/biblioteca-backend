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

const putAvatar = (cookie: string, body: Buffer, contentType = "image/jpeg") =>
  request(app)
    .put("/auth/me/avatar")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .set("Content-Type", contentType)
    .send(body);

describe("Given the PUT /auth/me/avatar endpoint", () => {
  describe("When a logged-in user sends a valid JPEG", () => {
    it("Then it should respond 200 with { user } carrying avatarUrl and GET /auth/me should show it", async () => {
      const cookie = await registerSession();

      const response = await putAvatar(cookie, buildJpegBuffer());
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body.user.avatarUrl).toMatch(
        /^\/api\/auth\/me\/avatar\?v=\d+$/,
      );
      expect(response.body.user).not.toHaveProperty("avatar");
      expect(me.body.user.avatarUrl).toBe(response.body.user.avatarUrl);
    });
  });

  describe("When the content type is not image/jpeg", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field avatar", async () => {
      const cookie = await registerSession();

      const response = await putAvatar(cookie, buildJpegBuffer(), "image/png");

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "avatar",
      });
    });
  });

  describe("When the file is larger than 200 KB", () => {
    it("Then it should respond 413 VALIDATION_ERROR with field avatar", async () => {
      const cookie = await registerSession();

      const response = await putAvatar(cookie, buildJpegBuffer(200 * 1024 + 1));

      expect(response.status).toBe(413);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "avatar",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .put("/auth/me/avatar")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .set("Content-Type", "image/jpeg")
        .send(buildJpegBuffer());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and not store the photo", async () => {
      const cookie = await registerSession();

      const response = await request(app)
        .put("/auth/me/avatar")
        .set("Cookie", cookie)
        .set("Content-Type", "image/jpeg")
        .send(buildJpegBuffer());
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.body.user.avatarUrl).toBeNull();
    });
  });
});
