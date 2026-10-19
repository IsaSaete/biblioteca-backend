import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// Mismo remitente de sandbox que sendVerificationEmail: cambiar ambos cuando
// se verifique un dominio propio.
const FROM_ADDRESS = "Biblioteca Personal <onboarding@resend.dev>";

const sendPasswordResetEmail = async (
  to: string,
  resetToken: string,
): Promise<void> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

  if (!config.isProduction) {
    logger.debug({ resetUrl }, "Password reset email link");
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Recupera tu contraseña — Glosa",
    html: `
      <p>Hemos recibido una solicitud para restablecer tu contraseña de Glosa.</p>
      <p>Crea una nueva contraseña desde el siguiente enlace (caduca en 1 hora):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Si no has sido tú, puedes ignorar este correo.</p>
    `,
  });

  // Solo se registra: si fallara con error, la respuesta de forgot-password
  // delataría que el email existe.
  if (error) {
    logger.error(error, "Failed to send password reset email");
  }
};

export default sendPasswordResetEmail;
