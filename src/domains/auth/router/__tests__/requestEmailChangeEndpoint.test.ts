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
const { default: sendNotice } =
  await import("../../../../shared/email/sendEmailChangeNoticeEmail.js");
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

const postEmail = (cookie: string, body: object) =>
  request(app)
    .post("/auth/me/email")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF)
    .send(body);

const NEW_EMAIL = "nueva@example.com";

const validBody = {
  newEmail: NEW_EMAIL,
  currentPassword: validRegisterDto.password,
};

describe("Given the POST /auth/me/email endpoint", () => {
  describe("When a logged-in user sends a free email and the right password", () => {
    it("Then it should respond 202, keep the current email and send the two emails", async () => {
      const { cookie } = await registerSession();

      const response = await postEmail(cookie, validBody);
      const me = await request(app).get("/auth/me").set("Cookie", cookie);

      expect(response.status).toBe(202);
      expect(me.body.user.email).toBe(validRegisterDto.email);
      expect(sendConfirmation).toHaveBeenCalledWith(
        NEW_EMAIL,
        expect.any(String),
      );
      expect(sendNotice).toHaveBeenCalledWith(
        validRegisterDto.email,
        NEW_EMAIL,
      );
    });
  });

  describe("When the password is wrong", () => {
    it("Then it should respond 401 AUTH_INVALID_CREDENTIALS", async () => {
      const { cookie } = await registerSession();

      const response = await postEmail(cookie, {
        ...validBody,
        currentPassword: "Wr0ng!Password",
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
    });
  });

  describe("When the email already belongs to another account", () => {
    it("Then it should respond 400 AUTH_EMAIL_TAKEN with field newEmail", async () => {
      const { cookie } = await registerSession();
      await request(app)
        .post("/auth/register")
        .send(buildRegisterDto({ email: NEW_EMAIL }));

      const response = await postEmail(cookie, validBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "AUTH_EMAIL_TAKEN",
        field: "newEmail",
      });
    });
  });

  describe("When the new email is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field newEmail", async () => {
      const { cookie } = await registerSession();

      const response = await postEmail(cookie, {
        ...validBody,
        newEmail: "no-es-email",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "newEmail",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/auth/me/email")
        .set("Cookie", `csrfToken=${CSRF}`)
        .set("X-CSRF-Token", CSRF)
        .send(validBody);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and send nothing", async () => {
      const { cookie } = await registerSession();

      const response = await request(app)
        .post("/auth/me/email")
        .set("Cookie", cookie)
        .send(validBody);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(sendConfirmation).not.toHaveBeenCalled();
    });
  });
});
