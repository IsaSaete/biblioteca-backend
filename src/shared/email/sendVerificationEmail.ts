import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { toSingleLine } from "./escapeHtml.js";
import { renderEmail } from "./renderEmail.js";

const resend = new Resend(config.resendApiKey);

// Tras registrarse se da la bienvenida; si luego se pide otro enlace desde
// Perfil (quizá meses después), un correo que «da la bienvenida» no tiene
// sentido: ese solo pide confirmar la dirección.
export type VerificationEmailKind = "welcome" | "reminder";

const buildContent = (
  kind: VerificationEmailKind,
  name: string,
  verificationUrl: string,
) => {
  if (kind === "reminder") {
    return {
      preheader: "Confirma tu dirección de correo con un solo clic.",
      heading: "Confirma tu correo de Glosa",
      paragraphs: [
        "Confirma tu dirección de correo para que podamos ayudarte si algún día olvidas tu contraseña o necesitas recuperar el acceso.",
        "No cambia nada de lo que puedes hacer en Glosa: es solo un paso de seguridad.",
      ],
      action: { label: "Confirmar mi correo", url: verificationUrl },
      notes: [
        "El enlace caduca en 24 horas. Si caduca, puedes pedir otro desde tu Perfil.",
        "Si no lo has pedido tú, puedes ignorar este correo.",
      ],
      aside: "Algunas lecturas merecen quedarse contigo.",
      reason:
        "Te escribimos porque se ha pedido confirmar el correo de una cuenta de Glosa con esta dirección.",
    };
  }

  return {
    preheader:
      "Tu cuenta ya está lista. Confirma tu correo cuando quieras: no cambia nada de lo que puedes hacer.",
    heading: `Te damos la bienvenida a Glosa, ${name}`,
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
  };
};

// Enlace para verificar el email. Verificar no bloquea nada (D-055): el correo
// lo dice, para que no parezca un trámite obligatorio.
const sendVerificationEmail = async (
  to: string,
  verificationToken: string,
  name: string,
  kind: VerificationEmailKind = "welcome",
): Promise<void> => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  if (!config.isProduction) {
    logger.debug({ verificationUrl }, "Verification email link");
  }

  const content = buildContent(kind, name, verificationUrl);
  const { html, text } = renderEmail(content);
  const heading = content.heading;

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
