import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { toSingleLine } from "./escapeHtml.js";
import { renderEmail } from "./renderEmail.js";

const resend = new Resend(config.resendApiKey);

// Bienvenida con el enlace para verificar el email. Verificar no bloquea nada
// (D-055): el correo lo dice, para que no parezca un trámite obligatorio.
const sendVerificationEmail = async (
  to: string,
  verificationToken: string,
  name: string,
): Promise<void> => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  if (!config.isProduction) {
    logger.debug({ verificationUrl }, "Verification email link");
  }

  const heading = `Te damos la bienvenida a Glosa, ${name}`;
  const { html, text } = renderEmail({
    preheader:
      "Tu cuenta ya está lista. Confirma tu correo cuando quieras: no cambia nada de lo que puedes hacer.",
    heading,
    paragraphs: [
      "Tu cuenta ya está lista: puedes empezar a catalogar tus libros ahora mismo, sin esperar a este correo.",
      "Solo te pedimos un favor: confirma tu dirección de correo. No cambia nada de lo que puedes hacer en Glosa, pero nos permite ayudarte si algún día olvidas tu contraseña o necesitas recuperar el acceso.",
    ],
    action: { label: "Confirmar mi correo", url: verificationUrl },
    notes: [
      "El enlace caduca en 24 horas. Si caduca, puedes pedir otro desde tu Perfil.",
      "Si no has creado una cuenta en Glosa, puedes ignorar este correo.",
    ],
    aside: "Algunas lecturas merecen quedarse contigo.",
    reason:
      "Te escribimos porque se ha creado una cuenta en Glosa con esta dirección.",
  });

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    replyTo: config.emailReplyTo,
    to,
    subject: toSingleLine(heading),
    html,
    text,
  });

  // No bloquea el registro: la verificación de email es recomendada, no
  // obligatoria para usar la app (api-contract.md).
  if (error) {
    logger.error(error, "Failed to send verification email");
  }
};

export default sendVerificationEmail;
