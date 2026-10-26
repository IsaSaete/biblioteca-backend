import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import getCookieValue from "../../../../test/getCookieValue.js";
import {
  buildRegisterDto,
  validRegisterDto,
} from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);
jest.unstable_mockModule(
  "../../../../shared/email/sendEmailChangeConfirmationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);
jest.unstable_mockModule(
  "../../../../shared/email/sendEmailChangeNoticeEmail.js",
  () => ({
    default: jest
      .fn<(to: string, newEmail: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const { default: sendConfirmation } =
  await import("../../../../shared/email/sendEmailChangeConfirmationEmail.js");
const { default: app } = await import("../../../../server/app.js");

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

const registerSession = async (): Promise<{
  cookie: string;
  refreshToken: string;
}> => {
  const register = await request(app)
    .post("/auth/register")
    .send(buildRegisterDto());

  return {
    cookie: `accessToken=${getCookieValue(register, "accessToken")}; csrfToken=${CSRF}`,
    refreshToken: getCookieValue(register, "refreshToken") ?? "",
  };
};

const NEW_EMAIL = "nueva@example.com";

const requestChange = async (cookie: string): Promise<string> => {
  await request(app)
    .post("/auth/me/email")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send({ newEmail: NEW_EMAIL, currentPassword: validRegisterDto.password });

  return jest.mocked(sendConfirmation).mock.calls.at(-1)?.[1] ?? "";
};

describe("Given the GET /auth/confirm-email-change endpoint", () => {
  describe("When it receives the valid token without a session", () => {
    it("Then it should respond 200 and the user should log in with the new email", async () => {
      const { cookie } = await registerSession();
      const token = await requestChange(cookie);

      const response = await request(app).get(
        `/auth/confirm-email-change?token=${token}`,
      );
      const login = await request(app).post("/auth/login").send({
        email: NEW_EMAIL,
        password: validRegisterDto.password,
      });

      expect(response.status).toBe(200);
      expect(login.status).toBe(200);
      expect(login.body.user).toMatchObject({
        email: NEW_EMAIL,
        emailVerified: true,
      });
    });

    it("Then the previous session should no longer refresh", async () => {
      const { cookie, refreshToken } = await registerSession();
      const token = await requestChange(cookie);

      await request(app).get(`/auth/confirm-email-change?token=${token}`);
      const refresh = await request(app)
        .post("/auth/refresh")
        .set("Cookie", `refreshToken=${refreshToken}; csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF);

      expect(refresh.status).toBe(401);
    });
  });

  describe("When the token is used a second time", () => {
    it("Then it should respond 400 AUTH_INVALID_TOKEN", async () => {
      const { cookie } = await registerSession();
      const token = await requestChange(cookie);
      await request(app).get(`/auth/confirm-email-change?token=${token}`);

      const response = await request(app).get(
        `/auth/confirm-email-change?token=${token}`,
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("AUTH_INVALID_TOKEN");
    });
  });

  describe("When the token is missing or made up", () => {
    it.each(["", "?token=", "?token=made-up"])(
      "Then it should respond 400 AUTH_INVALID_TOKEN for %p",
      async (query) => {
        const response = await request(app).get(
          `/auth/confirm-email-change${query}`,
        );

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("AUTH_INVALID_TOKEN");
      },
    );
  });

  describe("When someone registered the new email before the link was opened", () => {
    it("Then it should respond 400 AUTH_EMAIL_TAKEN", async () => {
      const { cookie } = await registerSession();
      const token = await requestChange(cookie);
      await request(app)
        .post("/auth/register")
        .send(buildRegisterDto({ email: NEW_EMAIL }));

      const response = await request(app).get(
        `/auth/confirm-email-change?token=${token}`,
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("AUTH_EMAIL_TAKEN");
    });
  });
});
