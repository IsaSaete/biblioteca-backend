import { jest } from "@jest/globals";
import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

const sendVerificationEmailMock = jest
  .fn<(to: string, token: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: sendVerificationEmailMock,
  }),
);

const { default: app } = await import("../../../../server/app.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
  sendVerificationEmailMock.mockClear();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const getLastSentVerificationToken = (): string => {
  const [, token] = sendVerificationEmailMock.mock.calls[0] as [string, string];
  return token;
};

describe("Given the GET /auth/verify-email endpoint", () => {
  describe("When it receives a valid verification token", () => {
    it("Then it should respond with status 200", async () => {
      const dto = buildRegisterDto();
      await request(app).post("/auth/register").send(dto);
      const token = getLastSentVerificationToken();

      const response = await request(app).get(
        `/auth/verify-email?token=${token}`,
      );

      expect(response.status).toBe(200);
    });
  });

  describe("When it receives an invalid token", () => {
    it("Then it should respond with status 400 and AUTH_INVALID_TOKEN", async () => {
      const response = await request(app).get(
        "/auth/verify-email?token=made-up-token",
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "AUTH_INVALID_TOKEN",
          message: expect.any(String),
        },
      });
    });
  });
});
