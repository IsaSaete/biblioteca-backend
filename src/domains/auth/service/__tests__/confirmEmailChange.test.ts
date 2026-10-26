import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
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
const { default: AuthService } = await import("../AuthService.js");
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

const NEW_EMAIL = "nueva@example.com";

const requestChange = async (userId: string, newEmail = NEW_EMAIL) => {
  await AuthService.requestEmailChange(userId, {
    newEmail,
    currentPassword: validRegisterDto.password,
  });

  return jest.mocked(sendConfirmation).mock.calls.at(-1)?.[1] ?? "";
};

describe("Given the AuthService.confirmEmailChange function", () => {
  describe("When it receives the valid token", () => {
    it("Then it should apply the pending email, mark it verified and clear the pending data", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);

      await AuthService.confirmEmailChange(token);

      const stored = await User.findById(user.id);
      expect(stored?.email).toBe(NEW_EMAIL);
      expect(stored?.emailVerified).toBe(true);
      expect(stored?.pendingEmail).toBeUndefined();
      expect(stored?.pendingEmailTokenHash).toBeUndefined();
      expect(stored?.pendingEmailTokenExpiresAt).toBeUndefined();
    });

    it("Then the user should log in with the new email and no longer with the old one", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);

      await AuthService.confirmEmailChange(token);

      await expect(
        AuthService.loginUser(buildLoginDto({ email: NEW_EMAIL })),
      ).resolves.toBeDefined();
      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    });

    it("Then it should invalidate the open sessions", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);

      await AuthService.confirmEmailChange(token);

      await expect(
        AuthService.refreshSession(session.refreshToken),
      ).rejects.toMatchObject({ code: "AUTH_UNAUTHENTICATED" });
    });
  });

  describe("When the email is not confirmed yet", () => {
    it("Then the current email should keep working", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await requestChange(user.id);

      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).resolves.toBeDefined();
    });
  });

  describe("When the token was already used", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);
      await AuthService.confirmEmailChange(token);

      await expect(AuthService.confirmEmailChange(token)).rejects.toMatchObject(
        { code: "AUTH_INVALID_TOKEN", httpStatus: 400 },
      );
    });
  });

  describe("When the token has expired", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN and keep the old email", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);
      await User.updateOne(
        { _id: user.id },
        { pendingEmailTokenExpiresAt: new Date(Date.now() - 1000) },
      );

      await expect(AuthService.confirmEmailChange(token)).rejects.toMatchObject(
        { code: "AUTH_INVALID_TOKEN" },
      );
      expect((await User.findById(user.id))?.email).toBe(
        validRegisterDto.email,
      );
    });
  });

  describe("When the user asked again and uses the first link", () => {
    it("Then the first link should fail and the second should apply the latest email", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const firstToken = await requestChange(user.id, NEW_EMAIL);
      const secondToken = await requestChange(user.id, "otra@example.com");

      await expect(
        AuthService.confirmEmailChange(firstToken),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
      await AuthService.confirmEmailChange(secondToken);

      expect((await User.findById(user.id))?.email).toBe("otra@example.com");
    });
  });

  describe("When someone registered the pending email in the meantime", () => {
    it("Then it should fail with AUTH_EMAIL_TAKEN and keep the old email", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const token = await requestChange(user.id);
      await AuthService.registerUser(buildRegisterDto({ email: NEW_EMAIL }));

      await expect(AuthService.confirmEmailChange(token)).rejects.toMatchObject(
        { code: "AUTH_EMAIL_TAKEN", httpStatus: 400 },
      );
      expect((await User.findById(user.id))?.email).toBe(
        validRegisterDto.email,
      );
    });
  });

  describe("When the token does not exist", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      await expect(
        AuthService.confirmEmailChange("made-up-token"),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
    });
  });
});
