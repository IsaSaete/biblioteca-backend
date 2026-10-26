import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// Mismo remitente de sandbox que sendVerificationEmail: cambiar todos a la vez
// cuando se verifique un dominio propio.
const FROM_ADDRESS = "Biblioteca Personal <onboarding@resend.dev>";

// Va al email NUEVO: abrir el enlace prueba que quien lo pidió controla el buzón.
const sendEmailChangeConfirmationEmail = async (
  to: string,
  confirmationToken: string,
): Promise<void> => {
  const confirmationUrl = `${config.frontendUrl}/confirm-email-change?token=${confirmationToken}`;

  if (!config.isProduction) {
    logger.debug({ confirmationUrl }, "Email change confirmation link");
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Confirma tu nuevo email — Glosa",
    html: `
      <p>Has pedido usar esta dirección como email de tu cuenta de Glosa.</p>
      <p>Confírmalo desde el siguiente enlace (caduca en 24 horas):</p>
      <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      <p>Si no has sido tú, puedes ignorar este correo.</p>
    `,
  });

  if (error) {
    logger.error(error, "Failed to send email change confirmation email");
  }
};

export default sendEmailChangeConfirmationEmail;
