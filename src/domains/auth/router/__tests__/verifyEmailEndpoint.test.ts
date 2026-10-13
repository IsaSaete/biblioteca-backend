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

describe("GET /auth/verify-email", () => {
  it("Given un token de verificación válido, when se llama al endpoint, then responde 200", async () => {
    // Arrange
    const dto = buildRegisterDto();
    await request(app).post("/auth/register").send(dto);
    const token = getLastSentVerificationToken();

    // Act
    const response = await request(app).get(
      `/auth/verify-email?token=${token}`,
    );

    // Assert
    expect(response.status).toBe(200);
  });

  it("Given un token inválido, when se llama al endpoint, then responde 400 con AUTH_INVALID_TOKEN", async () => {
    // Arrange / Act
    const response = await request(app).get(
      "/auth/verify-email?token=un-token-inventado",
    );

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "AUTH_INVALID_TOKEN",
        message: expect.any(String),
      },
    });
  });
});
