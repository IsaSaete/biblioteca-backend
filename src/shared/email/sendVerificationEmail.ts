import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const resend = new Resend(config.resendApiKey);

const sendVerificationEmail = async (
  to: string,
  verificationToken: string,
): Promise<void> => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  if (!config.isProduction) {
    logger.debug({ verificationUrl }, "Verification email link");
  }

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    replyTo: config.emailReplyTo,
    to,
    subject: "Confirma tu email — Glosa",
    html: `
      <p>¡Bienvenida a Glosa, tu biblioteca personal!</p>
      <p>Confirma tu email haciendo clic en el siguiente enlace:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    `,
  });

  // No bloquea el registro: la verificación de email es recomendada, no
  // obligatoria para usar la app (api-contract.md).
  if (error) {
    logger.error(error, "Failed to send verification email");
  }
};

export default sendVerificationEmail;
