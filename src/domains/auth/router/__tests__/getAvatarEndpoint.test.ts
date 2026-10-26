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

describe("Given the GET /auth/me/avatar endpoint", () => {
  describe("When a logged-in user has a photo", () => {
    it("Then it should respond 200 with the JPEG bytes, a private cache and an ETag", async () => {
      const cookie = await registerSession();
      const jpeg = buildJpegBuffer();
      await uploadAvatar(cookie, jpeg);

      const response = await request(app)
        .get("/auth/me/avatar")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("image/jpeg");
      expect(response.headers["cache-control"]).toBe("private");
      expect(response.headers.etag).toBeDefined();
      expect(Buffer.from(response.body).equals(jpeg)).toBe(true);
    });
  });

  describe("When the client sends the ETag it already has", () => {
    it("Then it should respond 304 without a body", async () => {
      const cookie = await registerSession();
      await uploadAvatar(cookie, buildJpegBuffer());
      const first = await request(app)
        .get("/auth/me/avatar")
        .set("Cookie", cookie);

      const response = await request(app)
        .get("/auth/me/avatar")
        .set("Cookie", cookie)
        .set("If-None-Match", first.headers.etag);

      expect(response.status).toBe(304);
      expect(response.body).toEqual({});
    });
  });

  describe("When the user has no photo", () => {
    it("Then it should respond 404 AVATAR_NOT_FOUND", async () => {
      const cookie = await registerSession();

      const response = await request(app)
        .get("/auth/me/avatar")
        .set("Cookie", cookie);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("AVATAR_NOT_FOUND");
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/auth/me/avatar");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
