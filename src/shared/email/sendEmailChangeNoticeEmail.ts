import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";

const resend = new Resend(config.resendApiKey);

// Mismo remitente de sandbox que sendVerificationEmail: cambiar todos a la vez
// cuando se verifique un dominio propio.
const FROM_ADDRESS = "Biblioteca Personal <onboarding@resend.dev>";

// Va al email ACTUAL: si el cambio no lo pidió su dueña, es la única señal de
// que alguien más tiene su sesión.
const sendEmailChangeNoticeEmail = async (
  to: string,
  newEmail: string,
): Promise<void> => {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Se ha pedido cambiar el email de tu cuenta — Glosa",
    html: `
      <p>Alguien ha pedido cambiar el email de tu cuenta de Glosa a <strong>${newEmail}</strong>.</p>
      <p>El cambio no se aplica hasta que se confirme desde esa dirección. Hasta entonces sigues entrando con este email.</p>
      <p>Si no has sido tú, cambia tu contraseña desde Perfil.</p>
    `,
  });

  if (error) {
    logger.error(error, "Failed to send email change notice email");
  }
};

export default sendEmailChangeNoticeEmail;
