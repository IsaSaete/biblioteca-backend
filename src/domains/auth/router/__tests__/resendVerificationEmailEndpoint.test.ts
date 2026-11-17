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

const { default: sendVerificationEmail } =
  await import("../../../../shared/email/sendVerificationEmail.js");
const { default: app } = await import("../../../../server/app.js");
const { default: User } = await import("../../model/User.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  jest.clearAllMocks();
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const CSRF = "csrf-value";

const registerCookie = async (): Promise<string> => {
  const register = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto());

  return `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`;
};

const postVerificationEmail = (cookie: string) =>
  request(app)
    .post("/auth/me/verification-email")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF);

describe("Given the POST /auth/me/verification-email endpoint", () => {
  describe("When a user with an unverified email asks for the link again", () => {
    it("Then it responds 202 and sends the email again", async () => {
      const cookie = await registerCookie();
      jest.mocked(sendVerificationEmail).mockClear();

      const response = await postVerificationEmail(cookie);

      expect(response.status).toBe(202);
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("When the email is already verified", () => {
    it("Then it responds 409 with AUTH_EMAIL_ALREADY_VERIFIED", async () => {
      const cookie = await registerCookie();
      await User.updateMany({}, { emailVerified: true });

      const response = await postVerificationEmail(cookie);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("AUTH_EMAIL_ALREADY_VERIFIED");
    });
  });

  describe("When there is no session", () => {
    it("Then it responds 401", async () => {
      const response = await request(app)
        .post("/auth/me/verification-email")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(response.status).toBe(401);
    });
  });

  describe("When the CSRF header is missing", () => {
    it("Then it responds 403", async () => {
      const cookie = await registerCookie();

      const response = await request(app)
        .post("/auth/me/verification-email")
        .set("Cookie", cookie);

      expect(response.status).toBe(403);
    });
  });
});
