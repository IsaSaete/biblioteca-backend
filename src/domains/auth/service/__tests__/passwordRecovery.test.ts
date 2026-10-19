import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
  NEW_VALID_PASSWORD,
  buildLoginDto,
  buildRegisterDto,
} from "../../fixtures/auth.fixtures.js";

const sendPasswordResetEmailMock = jest
  .fn<(to: string, token: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);
jest.unstable_mockModule(
  "../../../../shared/email/sendPasswordResetEmail.js",
  () => ({ default: sendPasswordResetEmailMock }),
);

const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { hashToken } = await import("../../../../utils/tokens.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
  sendPasswordResetEmailMock.mockClear();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const getSentResetToken = (): string => {
  const [, token] = sendPasswordResetEmailMock.mock.calls[0] as [
    string,
    string,
  ];
  return token;
};

describe("Given the AuthService.requestPasswordReset function", () => {
  describe("When it receives the email of a registered user", () => {
    it("Then it should store the hash of the token with a 1 hour expiry and email the token", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.requestPasswordReset({ email: "isa@example.com" });

      const token = getSentResetToken();
      const storedUser = await User.findById(user.id);
      expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
        "isa@example.com",
        token,
      );
      expect(storedUser?.passwordResetTokenHash).toBe(hashToken(token));
      expect(storedUser?.passwordResetTokenHash).not.toBe(token);
      const msLeft =
        (storedUser?.passwordResetTokenExpiresAt?.getTime() ?? 0) - Date.now();
      expect(msLeft).toBeGreaterThan(59 * 60 * 1000);
      expect(msLeft).toBeLessThanOrEqual(60 * 60 * 1000);
    });
  });

  describe("When it receives an email that is not registered", () => {
    it("Then it should resolve without sending any email", async () => {
      const result = AuthService.requestPasswordReset({
        email: "nobody@example.com",
      });

      await expect(result).resolves.toBeUndefined();
      expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    });
  });

  describe("When it receives an invalid email", () => {
    it("Then it should fail with VALIDATION_ERROR and the email field", async () => {
      const result = AuthService.requestPasswordReset({
        email: "not-an-email",
      });

      await expect(result).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "email",
      });
    });
  });
});

describe("Given the AuthService.resetPassword function", () => {
  const requestToken = async (): Promise<string> => {
    await AuthService.registerUser(buildRegisterDto());
    await AuthService.requestPasswordReset({ email: "isa@example.com" });
    return getSentResetToken();
  };

  describe("When it receives a valid token and a strong new password", () => {
    it("Then the new password works for login and the old one does not", async () => {
      const token = await requestToken();

      await AuthService.resetPassword({
        token,
        newPassword: NEW_VALID_PASSWORD,
      });

      await expect(
        AuthService.loginUser(buildLoginDto({ password: NEW_VALID_PASSWORD })),
      ).resolves.toBeDefined();
      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    });

    it("Then it should consume the token and revoke the open session", async () => {
      const token = await requestToken();

      await AuthService.resetPassword({
        token,
        newPassword: NEW_VALID_PASSWORD,
      });

      const storedUser = await User.findOne({ email: "isa@example.com" });
      expect(storedUser?.passwordResetTokenHash).toBeUndefined();
      expect(storedUser?.passwordResetTokenExpiresAt).toBeUndefined();
      expect(storedUser?.refreshTokenHash).toBeUndefined();
    });
  });

  describe("When the token is used a second time", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const token = await requestToken();
      await AuthService.resetPassword({
        token,
        newPassword: NEW_VALID_PASSWORD,
      });

      const result = AuthService.resetPassword({
        token,
        newPassword: "An0ther!Pass",
      });

      await expect(result).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });

  describe("When the token has expired", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const token = await requestToken();
      await User.updateOne(
        { email: "isa@example.com" },
        { passwordResetTokenExpiresAt: new Date(Date.now() - 1000) },
      );

      const result = AuthService.resetPassword({
        token,
        newPassword: NEW_VALID_PASSWORD,
      });

      await expect(result).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });

  describe("When the token does not exist", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const result = AuthService.resetPassword({
        token: "unknown",
        newPassword: NEW_VALID_PASSWORD,
      });

      await expect(result).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });

  describe("When the new password is weak", () => {
    it("Then it should fail with AUTH_WEAK_PASSWORD and the newPassword field, keeping the token valid", async () => {
      const token = await requestToken();

      const result = AuthService.resetPassword({ token, newPassword: "weak" });

      await expect(result).rejects.toMatchObject({
        code: "AUTH_WEAK_PASSWORD",
        field: "newPassword",
      });
      const storedUser = await User.findOne({ email: "isa@example.com" });
      expect(storedUser?.passwordResetTokenHash).toBe(hashToken(token));
    });
  });
});
