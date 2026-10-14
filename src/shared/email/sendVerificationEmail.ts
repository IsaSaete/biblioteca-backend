import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// Remitente del sandbox de Resend: mientras no se verifique un dominio
// propio, es el único remitente disponible y solo puede enviar a la
// dirección de email de la cuenta de Resend. Cuando se verifique un
// dominio, se cambia por el remitente definitivo en esta misma línea.
const FROM_ADDRESS = "Biblioteca Personal <onboarding@resend.dev>";

const sendVerificationEmail = async (
  to: string,
  verificationToken: string,
): Promise<void> => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  if (!config.isProduction) {
    logger.debug({ verificationUrl }, "Verification email link");
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
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
