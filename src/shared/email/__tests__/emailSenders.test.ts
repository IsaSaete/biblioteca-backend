import { jest } from "@jest/globals";

const sendMock = jest
  .fn<(payload: unknown) => Promise<{ error: null }>>()
  .mockResolvedValue({ error: null });

jest.unstable_mockModule("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const { default: config } = await import("../../../config/index.js");
const { default: sendVerificationEmail } =
  await import("../sendVerificationEmail.js");
const { default: sendPasswordResetEmail } =
  await import("../sendPasswordResetEmail.js");
const { default: sendEmailChangeConfirmationEmail } =
  await import("../sendEmailChangeConfirmationEmail.js");
const { default: sendEmailChangeNoticeEmail } =
  await import("../sendEmailChangeNoticeEmail.js");

beforeEach(() => sendMock.mockClear());

describe("Given the sender configured for the emails of the app", () => {
  describe("When no environment variable overrides it", () => {
    it("Then emails come from the Glosa address and replies go to contact", () => {
      expect(config.emailFrom).toBe("Glosa <no-reply@glosaapp.com>");
      expect(config.emailReplyTo).toBe("contacto@glosaapp.com");
    });
  });

  describe("When any email of the app is sent", () => {
    it.each([
      ["verification", sendVerificationEmail],
      ["password reset", sendPasswordResetEmail],
      ["email change confirmation", sendEmailChangeConfirmationEmail],
      ["email change notice", sendEmailChangeNoticeEmail],
    ] as const)(
      "Then the %s email uses the configured sender and reply address",
      async (_name, send) => {
        await send("reader@example.com", "token-or-new-email");

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock).toHaveBeenCalledWith(
          expect.objectContaining({
            from: config.emailFrom,
            replyTo: config.emailReplyTo,
            to: "reader@example.com",
          }),
        );
      },
    );
  });
});
