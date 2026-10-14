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

describe("POST /auth/register", () => {
  it("Given datos de registro válidos, when se llama al endpoint, then responde 201 con el usuario y las cookies de sesión", async () => {
    // Arrange
    const dto = buildRegisterDto();

    // Act
    const response = await request(app).post("/auth/register").send(dto);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        name: dto.name,
        email: dto.email,
      },
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    const setCookieHeader = response.get("Set-Cookie");
    expect(setCookieHeader).toBeDefined();

    const cookieNames = setCookieHeader?.map((cookie) => cookie.split("=")[0]);
    expect(cookieNames).toEqual(
      expect.arrayContaining(["accessToken", "refreshToken", "csrfToken"]),
    );
  });

  it("Given un email ya registrado, when se llama al endpoint, then responde 400 con AUTH_EMAIL_TAKEN", async () => {
    // Arrange
    const dto = buildRegisterDto();
    await request(app).post("/auth/register").send(dto);

    // Act
    const response = await request(app).post("/auth/register").send(dto);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "AUTH_EMAIL_TAKEN",
        message: expect.any(String),
        field: "email",
      },
    });
  });

  it("Given una contraseña débil, when se llama al endpoint, then responde 400 con AUTH_WEAK_PASSWORD y el campo señalado", async () => {
    // Arrange
    const dto = buildRegisterDto({ password: "weak" });

    // Act
    const response = await request(app).post("/auth/register").send(dto);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "AUTH_WEAK_PASSWORD",
        message: expect.any(String),
        field: "password",
      },
    });
  });

  it("Given acceptedTerms ausente, when se llama al endpoint, then responde 400", async () => {
    // Arrange
    const dto = buildRegisterDto();
    const { acceptedTerms: _acceptedTerms, ...bodyWithoutTerms } = dto;

    // Act
    const response = await request(app)
      .post("/auth/register")
      .send(bodyWithoutTerms);

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
