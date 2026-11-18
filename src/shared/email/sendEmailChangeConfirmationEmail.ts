import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { renderEmail } from "./renderEmail.js";

const resend = new Resend(config.resendApiKey);

// Va al email NUEVO: abrir el enlace prueba que quien lo pidió controla el buzón.
const sendEmailChangeConfirmationEmail = async (
  to: string,
  confirmationToken: string,
): Promise<void> => {
  const confirmationUrl = `${config.frontendUrl}/confirm-email-change?token=${confirmationToken}`;

  if (!config.isProduction) {
    logger.debug({ confirmationUrl }, "Email change confirmation link");
  }

  const { html, text } = renderEmail({
    preheader: "Confirma que esta dirección será el email de tu cuenta.",
    heading: "Confirma tu nuevo email",
    paragraphs: [
      "Has pedido usar esta dirección como email de tu cuenta de Glosa.",
      "Confírmalo desde el siguiente botón.",
    ],
    action: { label: "Confirmar este email", url: confirmationUrl },
    notes: [
      "El enlace caduca en 24 horas.",
      "Si no has sido tú, puedes ignorar este correo.",
    ],
    reason:
      "Te escribimos porque se ha pedido usar esta dirección en una cuenta de Glosa.",
  });

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    replyTo: config.emailReplyTo,
    to,
    subject: "Confirma tu nuevo email — Glosa",
    html,
    text,
  });

  if (error) {
    logger.error(error, "Failed to send email change confirmation email");
  }
};

export default sendEmailChangeConfirmationEmail;
