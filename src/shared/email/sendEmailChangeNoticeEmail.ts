import { Resend } from "resend";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { renderEmail } from "./renderEmail.js";

const resend = new Resend(config.resendApiKey);

// Va al email ACTUAL: si el cambio no lo pidió su dueña, es la única señal de
// que alguien más tiene su sesión.
const sendEmailChangeNoticeEmail = async (
  to: string,
  newEmail: string,
): Promise<void> => {
  const { html, text } = renderEmail({
    preheader: "Alguien ha pedido cambiar el email de tu cuenta.",
    heading: "Se ha pedido cambiar el email de tu cuenta",
    paragraphs: [
      [
        "Alguien ha pedido cambiar el email de tu cuenta de Glosa a ",
        { strong: newEmail },
        ".",
      ],
      "El cambio no se aplica hasta que se confirme desde esa dirección. Hasta entonces sigues entrando con este email.",
      "Si no has sido tú, cambia tu contraseña desde Perfil.",
    ],
    reason: "Te escribimos porque es el email de tu cuenta de Glosa.",
  });

  const { error } = await resend.emails.send({
    from: config.emailFrom,
    replyTo: config.emailReplyTo,
    to,
    subject: "Se ha pedido cambiar el email de tu cuenta — Glosa",
    html,
    text,
  });

  if (error) {
    logger.error(error, "Failed to send email change notice email");
  }
};

export default sendEmailChangeNoticeEmail;
