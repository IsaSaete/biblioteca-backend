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
      [
        "verification",
        () => sendVerificationEmail("reader@example.com", "token", "Isa"),
      ],
      [
        "password reset",
        () => sendPasswordResetEmail("reader@example.com", "token"),
      ],
      [
        "email change confirmation",
        () => sendEmailChangeConfirmationEmail("reader@example.com", "token"),
      ],
      [
        "email change notice",
        () =>
          sendEmailChangeNoticeEmail("reader@example.com", "new@example.com"),
      ],
    ] as const)(
      "Then the %s email uses the configured sender and reply address and has an HTML and a plain text version",
      async (_name, send) => {
        await send();

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock).toHaveBeenCalledWith(
          expect.objectContaining({
            from: config.emailFrom,
            replyTo: config.emailReplyTo,
            to: "reader@example.com",
            html: expect.stringContaining("Glosa"),
            text: expect.stringContaining("Glosa"),
          }),
        );
      },
    );
  });

  describe("When the verification email is sent", () => {
    it("Then it welcomes the user by name, says it does not block anything and carries the link", async () => {
      await sendVerificationEmail("reader@example.com", "abc123", "Isa");

      const payload = sendMock.mock.calls[0]?.[0] as {
        subject: string;
        html: string;
        text: string;
      };
      expect(payload.subject).toBe("Te damos la bienvenida a Glosa, Isa");
      expect(payload.html).toContain("Te damos la bienvenida a Glosa, Isa");
      expect(payload.text).toContain("sin esperar a este correo");
      expect(payload.text).toContain("/verify-email?token=abc123");
      expect(payload.html).toContain("/verify-email?token=abc123");
    });

    it("Then the reminder sent from the profile does not welcome anyone and only asks to confirm the address", async () => {
      await sendVerificationEmail(
        "reader@example.com",
        "abc123",
        "Isa",
        "reminder",
      );

      const payload = sendMock.mock.calls[0]?.[0] as {
        subject: string;
        html: string;
        text: string;
      };
      expect(payload.subject).toBe("Confirma tu correo de Glosa");
      expect(payload.html).not.toContain("bienvenida");
      expect(payload.text).not.toContain("cuenta ya está lista");
      expect(payload.text).toContain("/verify-email?token=abc123");
      expect(payload.html).toContain("/verify-email?token=abc123");
    });

    it("Then a name with HTML is escaped and a name with line breaks stays on one line in the subject", async () => {
      await sendVerificationEmail(
        "reader@example.com",
        "abc123",
        "<img src=x onerror=alert(1)>\nBcc: other@example.com",
      );

      const payload = sendMock.mock.calls[0]?.[0] as {
        subject: string;
        html: string;
      };
      expect(payload.html).not.toContain("<img src=x");
      expect(payload.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(payload.subject).not.toContain("\n");
    });
  });
});
