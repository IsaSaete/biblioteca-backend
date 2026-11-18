import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { renderEmail } from "./renderEmail.js";

const resend = new Resend(config.resendApiKey);

const sendPasswordResetEmail = async (
  to: string,
  resetToken: string,
): Promise<void> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  if (!config.isProduction) {
    logger.debug({ resetUrl }, "Password reset email link");
  }

  const { html, text } = renderEmail({
    preheader: "Crea una nueva contraseña. El enlace caduca en 1 hora.",
    heading: "Recupera tu contraseña",
    paragraphs: [
      "Hemos recibido una solicitud para restablecer tu contraseña de Glosa.",
      "Crea una nueva contraseña desde el siguiente botón.",
    ],
    action: { label: "Crear nueva contraseña", url: resetUrl },
    notes: [
      "El enlace caduca en 1 hora.",
      "Si no has sido tú, puedes ignorar este correo: tu contraseña no cambiará.",
    ],
    reason:
      "Te escribimos porque se ha pedido recuperar la contraseña de tu cuenta de Glosa.",
  });

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    replyTo: config.emailReplyTo,
    to,
    subject: "Recupera tu contraseña — Glosa",
    html,
    text,
  });

  // Solo se registra: si fallara con error, la respuesta de forgot-password
  // delataría que el email existe.
  if (error) {
    logger.error(error, "Failed to send password reset email");
  }
};

export default sendPasswordResetEmail;
