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
const { default: User } = await import("../../model/User.js");

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

const complete = (cookie: string) =>
  request(app)
    .post("/auth/onboarding/complete")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF);

describe("Given the POST /auth/onboarding/complete endpoint", () => {
  describe("When a logged-in user completes or skips the onboarding", () => {
    it("Then it should respond 204 and login and me should report onboardingCompleted true", async () => {
      const cookie = await registerSession();

      const response = await complete(cookie);
      const me = await request(app).get("/auth/me").set("Cookie", cookie);
      const login = await request(app).post("/auth/login").send({
        email: "isa@example.com",
        password: buildRegisterDto().password,
      });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(me.body.user.onboardingCompleted).toBe(true);
      expect(login.body.user.onboardingCompleted).toBe(true);
    });
  });

  describe("When it is called twice", () => {
    it("Then both calls should respond 204 and the date should not change", async () => {
      const cookie = await registerSession();
      await complete(cookie);
      const firstDate = (await User.findOne())?.onboardingCompletedAt;

      const second = await complete(cookie);

      expect(second.status).toBe(204);
      expect((await User.findOne())?.onboardingCompletedAt?.getTime()).toBe(
        firstDate?.getTime(),
      );
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/auth/onboarding/complete")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and not mark the onboarding", async () => {
      const cookie = await registerSession();

      const response = await request(app)
        .post("/auth/onboarding/complete")
        .set("Cookie", cookie);
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(me.body.user.onboardingCompleted).toBe(false);
    });
  });
});
