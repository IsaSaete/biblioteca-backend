import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
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
const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { default: mongoose } = await import("mongoose");
const { hashToken } = await import("../../../../utils/tokens.js");

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

const sendVerificationEmailMock = jest.mocked(sendVerificationEmail);

describe("Given the AuthService.resendVerificationEmail function", () => {
  describe("When the email of the user is not verified yet", () => {
    it("Then it replaces the verification link and sends a new one", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const firstToken = sendVerificationEmailMock.mock.calls[0]?.[1] ?? "";
      sendVerificationEmailMock.mockClear();

      await AuthService.resendVerificationEmail(user.id);

      expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
      const [to, newToken, name] =
        sendVerificationEmailMock.mock.calls[0] ?? [];
      expect(to).toBe(user.email);
      expect(name).toBe(user.name);
      expect(newToken).not.toBe(firstToken);

      const stored = await User.findById(user.id);
      expect(stored?.emailVerificationTokenHash).toBe(
        hashToken(newToken ?? ""),
      );
      expect(stored?.emailVerificationTokenHash).not.toBe(
        hashToken(firstToken),
      );
      expect(
        stored?.emailVerificationTokenExpiresAt?.getTime(),
      ).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    });
  });

  describe("When the email is already verified", () => {
    it("Then it fails with AUTH_EMAIL_ALREADY_VERIFIED and sends nothing", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await User.findByIdAndUpdate(user.id, { emailVerified: true });
      sendVerificationEmailMock.mockClear();

      await expect(
        AuthService.resendVerificationEmail(user.id),
      ).rejects.toMatchObject({ code: "AUTH_EMAIL_ALREADY_VERIFIED" });
      expect(sendVerificationEmailMock).not.toHaveBeenCalled();
    });
  });

  describe("When the user does not exist", () => {
    it("Then it fails as unauthenticated", async () => {
      await expect(
        AuthService.resendVerificationEmail(
          new mongoose.Types.ObjectId().toString(),
        ),
      ).rejects.toMatchObject({ code: "AUTH_UNAUTHENTICATED" });
    });
  });
});
