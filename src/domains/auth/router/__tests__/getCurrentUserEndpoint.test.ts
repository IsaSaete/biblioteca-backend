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

describe("Given the GET /auth/me endpoint", () => {
  describe("When the request carries the session cookies of a logged-in user", () => {
    it("Then it should respond 200 with the user without sensitive fields", async () => {
      const login = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const accessToken = getCookieValue(login, "accessToken");

      const response = await request(app)
        .get("/auth/me")
        .set("Cookie", `accessToken=${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          name: "Isa",
          email: "isa@example.com",
          onboardingCompleted: false,
          preferences: { libraryView: "grid" },
        },
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { code: "AUTH_UNAUTHENTICATED", message: expect.any(String) },
      });
    });
  });

  describe("When the accessToken belongs to a user that no longer exists", () => {
    it("Then it should respond 401 with AUTH_UNAUTHENTICATED", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send(buildRegisterDto());
      const accessToken = getCookieValue(register, "accessToken");
      await clearMemoryDatabase();

      const response = await request(app)
        .get("/auth/me")
        .set("Cookie", `accessToken=${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
