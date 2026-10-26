import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
  buildLoginDto,
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

const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { hashToken } = await import("../../../../utils/tokens.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

beforeEach(async () => {
  await AuthService.registerUser(buildRegisterDto());
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

describe("Given the AuthService.loginUser function", () => {
  describe("When it receives the credentials of a registered user", () => {
    it("Then it should return the user without sensitive fields", async () => {
      const dto = buildLoginDto();

      const result = await AuthService.loginUser(dto);

      expect(result.user).toEqual({
        id: expect.any(String),
        name: "Isa",
        email: dto.email,
        emailVerified: false,
        avatarUrl: null,
        onboardingCompleted: false,
        preferences: { libraryView: "grid" },
      });
    });

    it("Then it should store the hash of the new refresh token, never the token itself", async () => {
      const dto = buildLoginDto();

      const { session } = await AuthService.loginUser(dto);

      const storedUser = await User.findOne({ email: dto.email });
      expect(storedUser?.refreshTokenHash).toBe(
        hashToken(session.refreshToken),
      );
      expect(storedUser?.refreshTokenHash).not.toBe(session.refreshToken);
    });
  });

  describe("When it receives the email in different case", () => {
    it("Then it should log the user in", async () => {
      const dto = buildLoginDto({ email: "ISA@Example.com" });

      const result = await AuthService.loginUser(dto);

      expect(result.user.email).toBe("isa@example.com");
    });
  });

  describe("When it receives a wrong password", () => {
    it("Then it should fail with AUTH_INVALID_CREDENTIALS", async () => {
      const dto = buildLoginDto({ password: "Wr0ng!Password" });

      const result = AuthService.loginUser(dto);

      await expect(result).rejects.toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
      });
    });
  });

  describe("When it receives an email that is not registered", () => {
    it("Then it should fail with the same AUTH_INVALID_CREDENTIALS error and message", async () => {
      const wrongPassword = AuthService.loginUser(
        buildLoginDto({ password: "Wr0ng!Password" }),
      ).catch((error: unknown) => error);
      const unknownEmail = AuthService.loginUser(
        buildLoginDto({ email: "nobody@example.com" }),
      ).catch((error: unknown) => error);

      const [wrongPasswordError, unknownEmailError] = await Promise.all([
        wrongPassword,
        unknownEmail,
      ]);

      expect(unknownEmailError).toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
        message: (wrongPasswordError as Error).message,
      });
    });
  });

  describe("When it receives a body without password", () => {
    it("Then it should fail with VALIDATION_ERROR and the password field", async () => {
      const result = AuthService.loginUser({ email: "isa@example.com" });

      await expect(result).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "password",
      });
    });
  });
});
