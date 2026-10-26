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

const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { default: mongoose } = await import("mongoose");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const { hashToken } = await import("../../../../utils/tokens.js");

describe("Given the AuthService.changePassword function", () => {
  describe("When the current password is right and the new one is valid", () => {
    it("Then the new password should log in and the old one should not", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.changePassword(user.id, {
        currentPassword: validRegisterDto.password,
        newPassword: NEW_VALID_PASSWORD,
      });

      await expect(
        AuthService.loginUser(buildLoginDto({ password: NEW_VALID_PASSWORD })),
      ).resolves.toBeDefined();
      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    });

    it("Then it should open a new session and the previous refresh token should stop working", async () => {
      const { user, session: oldSession } =
        await AuthService.registerUser(buildRegisterDto());

      const newSession = await AuthService.changePassword(user.id, {
        currentPassword: validRegisterDto.password,
        newPassword: NEW_VALID_PASSWORD,
      });

      expect((await User.findById(user.id))?.refreshTokenHash).toBe(
        hashToken(newSession.refreshToken),
      );
      await expect(
        AuthService.refreshSession(oldSession.refreshToken),
      ).rejects.toMatchObject({ code: "AUTH_UNAUTHENTICATED" });
    });

    it("Then it should store the password hashed, never in plain text", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.changePassword(user.id, {
        currentPassword: validRegisterDto.password,
        newPassword: NEW_VALID_PASSWORD,
      });

      const stored = await User.findById(user.id);
      expect(stored?.passwordHash).not.toBe(NEW_VALID_PASSWORD);
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe("When the current password is wrong", () => {
    it("Then it should fail with AUTH_INVALID_CREDENTIALS and keep the password and the session", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.changePassword(user.id, {
          currentPassword: "Wr0ng!Password",
          newPassword: NEW_VALID_PASSWORD,
        }),
      ).rejects.toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
      });
      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).resolves.toBeDefined();
      expect((await User.findById(user.id))?.refreshTokenHash).not.toBe(
        hashToken(session.refreshToken),
      );
    });
  });

  describe.each([
    ["too short", "Sh0rt!"],
    ["without an uppercase letter", "n0uppercase!"],
    ["without a number", "NoNumber!!"],
    ["without a symbol", "NoSymbol123"],
  ])("When the new password is %s", (_case, newPassword) => {
    it("Then it should fail with AUTH_WEAK_PASSWORD on newPassword and keep the old one", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.changePassword(user.id, {
          currentPassword: validRegisterDto.password,
          newPassword,
        }),
      ).rejects.toMatchObject({
        code: "AUTH_WEAK_PASSWORD",
        field: "newPassword",
      });
      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).resolves.toBeDefined();
    });
  });

  describe.each([
    ["missing", { newPassword: NEW_VALID_PASSWORD }],
    ["empty", { currentPassword: "", newPassword: NEW_VALID_PASSWORD }],
    ["not a string", { currentPassword: 1, newPassword: NEW_VALID_PASSWORD }],
  ])("When the current password is %s", (_case, body) => {
    it("Then it should fail with VALIDATION_ERROR on currentPassword", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.changePassword(user.id, body),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "currentPassword",
      });
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.changePassword(unknownId, {
          currentPassword: validRegisterDto.password,
          newPassword: NEW_VALID_PASSWORD,
        }),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
