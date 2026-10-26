import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
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
const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { default: mongoose } = await import("mongoose");

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

const { hashToken } = await import("../../../../utils/tokens.js");

const NEW_EMAIL = "nueva@example.com";

const validBody = {
  newEmail: NEW_EMAIL,
  currentPassword: validRegisterDto.password,
};

describe("Given the AuthService.requestEmailChange function", () => {
  describe("When the password is right and the new email is free", () => {
    it("Then it should keep email unchanged and store the pending email with a hashed token valid for ~24 h", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.requestEmailChange(user.id, validBody);

      const stored = await User.findById(user.id);
      const sentToken = jest.mocked(sendConfirmation).mock.calls[0][1];
      expect(stored?.email).toBe(validRegisterDto.email);
      expect(stored?.pendingEmail).toBe(NEW_EMAIL);
      expect(stored?.pendingEmailTokenHash).toBe(hashToken(sentToken));
      expect(stored?.pendingEmailTokenHash).not.toBe(sentToken);
      const ttl =
        (stored?.pendingEmailTokenExpiresAt?.getTime() ?? 0) - Date.now();
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it("Then it should send the confirmation link to the new email and a notice to the current one", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.requestEmailChange(user.id, validBody);

      expect(sendConfirmation).toHaveBeenCalledWith(
        NEW_EMAIL,
        expect.any(String),
      );
      expect(sendNotice).toHaveBeenCalledWith(
        validRegisterDto.email,
        NEW_EMAIL,
      );
    });

    it("Then it should normalize the new email", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.requestEmailChange(user.id, {
        ...validBody,
        newEmail: "  Nueva@Example.COM ",
      });

      expect((await User.findById(user.id))?.pendingEmail).toBe(NEW_EMAIL);
    });
  });

  describe("When the user asks again with another email", () => {
    it("Then the new request should replace the pending email and its token", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.requestEmailChange(user.id, validBody);
      const firstToken = jest.mocked(sendConfirmation).mock.calls[0][1];

      await AuthService.requestEmailChange(user.id, {
        ...validBody,
        newEmail: "otra@example.com",
      });

      const stored = await User.findById(user.id);
      expect(stored?.pendingEmail).toBe("otra@example.com");
      expect(stored?.pendingEmailTokenHash).not.toBe(hashToken(firstToken));
    });
  });

  describe("When the current password is wrong", () => {
    it("Then it should fail with AUTH_INVALID_CREDENTIALS and send and store nothing", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.requestEmailChange(user.id, {
          ...validBody,
          currentPassword: "Wr0ng!Password",
        }),
      ).rejects.toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
      });
      expect((await User.findById(user.id))?.pendingEmail).toBeUndefined();
      expect(sendConfirmation).not.toHaveBeenCalled();
      expect(sendNotice).not.toHaveBeenCalled();
    });
  });

  describe("When another account already uses the new email", () => {
    it("Then it should fail with AUTH_EMAIL_TAKEN on newEmail and send nothing", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.registerUser(buildRegisterDto({ email: NEW_EMAIL }));

      await expect(
        AuthService.requestEmailChange(user.id, validBody),
      ).rejects.toMatchObject({
        code: "AUTH_EMAIL_TAKEN",
        httpStatus: 400,
        field: "newEmail",
      });
      expect(sendConfirmation).not.toHaveBeenCalled();
    });
  });

  describe("When the new email is the one the account already has", () => {
    it("Then it should fail with AUTH_EMAIL_TAKEN on newEmail", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.requestEmailChange(user.id, {
          ...validBody,
          newEmail: validRegisterDto.email.toUpperCase(),
        }),
      ).rejects.toMatchObject({ code: "AUTH_EMAIL_TAKEN", field: "newEmail" });
    });
  });

  describe.each([
    ["missing", { currentPassword: validRegisterDto.password }, "newEmail"],
    ["not an email", { ...validBody, newEmail: "no-es-email" }, "newEmail"],
    ["not a string", { ...validBody, newEmail: 3 }, "newEmail"],
    ["missing password", { newEmail: NEW_EMAIL }, "currentPassword"],
    [
      "empty password",
      { ...validBody, currentPassword: "" },
      "currentPassword",
    ],
  ])("When the body has %s", (_case, body, field) => {
    it(`Then it should fail with VALIDATION_ERROR on ${field}`, async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.requestEmailChange(user.id, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field });
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.requestEmailChange(unknownId, validBody),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
