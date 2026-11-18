import config from "../../config/index.js";
import { emailTheme as theme, emailThemeDark as dark } from "./emailTheme.js";
import { escapeHtml } from "./escapeHtml.js";

// Un texto con partes en negrita. Solo se admite lo necesario, y todo se
// escapa: el contenido nunca se interpreta como HTML.
export type Inline = string | { strong: string };
export type Paragraph = Inline | Inline[];

export interface EmailContent {
  // Lo que se ve junto al asunto en la bandeja de entrada.
  preheader: string;
  heading: string;
  paragraphs: Paragraph[];
  // Botón principal; su enlace se repite en texto para quien no pueda pulsarlo.
  action?: { label: string; url: string };
  // Letra pequeña bajo el botón (caducidad, «si no has sido tú…»).
  notes?: string[];
  // Nota al margen, como las glosas de la landing.
  aside?: string;
  // Por qué se recibe este correo («Te escribimos porque…»): lo que hace que un
  // correo automático se sienta legítimo. Va en el pie y es obligatorio.
  reason: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const toInlines = (paragraph: Paragraph): Inline[] =>
  Array.isArray(paragraph) ? paragraph : [paragraph];

const inlineToHtml = (inline: Inline): string =>
  typeof inline === "string"
    ? escapeHtml(inline)
    : `<strong>${escapeHtml(inline.strong)}</strong>`;

const inlineToText = (inline: Inline): string =>
  typeof inline === "string" ? inline : inline.strong;

const paragraphHtml = (paragraph: Paragraph): string =>
  `<p class="em-text" style="margin:0 0 16px;font-family:${theme.sans};font-size:16px;line-height:1.6;color:${theme.text};">${toInlines(paragraph).map(inlineToHtml).join("")}</p>`;

// Botón «a prueba de Outlook»: una tabla con el color de fondo en la celda, que
// es lo único que todos los clientes respetan. Va centrado.
const buttonHtml = ({ label, url }: { label: string; url: string }): string => `
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 24px;">
  <tr>
    <td class="em-btn" bgcolor="${theme.primary}" style="border-radius:999px;background-color:${theme.primary};">
      <a class="em-btn-text" href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:${theme.sans};font-size:16px;font-weight:600;line-height:1;text-align:center;color:${theme.onPrimary};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

const brand = { name: "Glosa", tagline: "Tu biblioteca personal" };

// Estilos que solo entienden los clientes con soporte (la mayoría de los
// móviles): el tema oscuro de la app y una palabra «Glosa» algo menor en
// pantallas estrechas. Los estilos en línea del HTML son el diseño claro, que
// es el que ven todos los demás.
const headStyles = `
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (max-width: 400px) {
  .em-pad-x { padding-left: 24px !important; padding-right: 24px !important; }
}
@media (max-width: 385px) {
  .em-word { font-size: 34px !important; }
  .em-tag { font-size: 12px !important; }
}
@media (max-width: 370px) {
  .em-icon { width: 36px !important; height: 36px !important; }
  .em-word { font-size: 32px !important; }
}
@media (max-width: 340px) {
  .em-tag-wrap { display: none !important; }
}
@media (prefers-color-scheme: dark) {
  .em-bg { background-color: ${dark.paper} !important; }
  .em-card { background-color: ${dark.card} !important; border-color: ${dark.line} !important; }
  .em-line-b { border-bottom-color: ${dark.line} !important; }
  .em-line-t { border-top-color: ${dark.line} !important; }
  .em-tag { border-left-color: ${dark.lineStrong} !important; }
  .em-text { color: ${dark.text} !important; }
  .em-muted, .em-muted a { color: ${dark.muted} !important; }
  a.em-link { color: ${dark.primary} !important; }
  .em-btn { background-color: ${dark.primary} !important; }
  .em-btn-text { color: ${dark.onPrimary} !important; }
  .em-note { color: ${dark.note} !important; border-left-color: ${dark.primary} !important; }
}
</style>`;

// Diseño común de los correos de Glosa. Se escribe con tablas y estilos en
// línea porque es lo único que se ve igual en Gmail, Outlook y Apple Mail.
export const renderEmail = (content: EmailContent): RenderedEmail => {
  const site = config.frontendUrl.replace(/\/$/, "");
  const iconUrl = `${site}/icons/icon-192.png`;
  const privacyUrl = `${site}/privacy`;
  const termsUrl = `${site}/terms`;
  const contact = config.emailReplyTo;

  const notesHtml = (content.notes ?? [])
    .map(
      (note) =>
        `<p class="em-muted" style="margin:0 0 8px;font-family:${theme.sans};font-size:14px;line-height:1.5;color:${theme.muted};">${escapeHtml(note)}</p>`,
    )
    .join("");

  const linkFallbackHtml = content.action
    ? `<p class="em-muted" style="margin:0 0 8px;font-family:${theme.sans};font-size:14px;line-height:1.5;color:${theme.muted};">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><a class="em-link" href="${escapeHtml(content.action.url)}" style="color:${theme.primary};word-break:break-all;">${escapeHtml(content.action.url)}</a></p>`
    : "";

  const asideHtml = content.aside
    ? `<p class="em-note" style="margin:24px 0 0;padding-left:14px;border-left:2px solid ${theme.primary};font-family:${theme.serif};font-style:italic;font-size:18px;line-height:1.4;color:${theme.note};">${escapeHtml(content.aside)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(content.heading)}</title>${headStyles}
</head>
<body class="em-bg" style="margin:0;padding:0;background-color:${theme.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>
<table class="em-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="em-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${theme.card};border:1px solid ${theme.line};border-radius:12px;">
        <tr>
          <td class="em-line-b em-pad-x" style="padding:28px 32px 24px;border-bottom:1px solid ${theme.line};">
            <a href="${escapeHtml(site)}" style="text-decoration:none;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px;vertical-align:bottom;">
                    <img class="em-icon" src="${escapeHtml(iconUrl)}" width="40" height="40" alt="" style="display:block;border:0;border-radius:9px;">
                  </td>
                  <td class="em-word em-text" style="vertical-align:bottom;font-family:${theme.serif};font-size:38px;line-height:40px;white-space:nowrap;color:${theme.text};">${brand.name}</td>
                  <td class="em-tag-wrap" style="padding-left:12px;padding-bottom:3px;vertical-align:bottom;">
                    <div class="em-tag em-muted" style="padding-left:12px;border-left:1px solid ${theme.lineStrong};font-family:${theme.sans};font-size:13px;line-height:18px;white-space:nowrap;color:${theme.muted};">${brand.tagline}</div>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>
        <tr>
          <td class="em-pad-x" style="padding:32px;">
            <h1 class="em-text" style="margin:0 0 20px;font-family:${theme.serif};font-size:26px;line-height:1.25;font-weight:normal;color:${theme.text};">${escapeHtml(content.heading)}</h1>
            ${content.paragraphs.map(paragraphHtml).join("\n            ")}
            ${content.action ? buttonHtml(content.action) : ""}
            ${linkFallbackHtml}
            ${notesHtml}
            ${asideHtml}
          </td>
        </tr>
        <tr>
          <td class="em-muted em-line-t em-pad-x" style="padding:20px 32px 28px;border-top:1px solid ${theme.line};font-family:${theme.sans};font-size:13px;line-height:1.6;color:${theme.muted};">
            <p style="margin:0 0 8px;">${escapeHtml(content.reason)}</p>
            <p style="margin:0 0 16px;">¿Necesitas ayuda? Responde a este correo o escribe a <a class="em-link" href="mailto:${escapeHtml(contact)}" style="color:${theme.primary};">${escapeHtml(contact)}</a>.</p>
            <p style="margin:0;font-size:12px;"><a href="${escapeHtml(privacyUrl)}" style="color:${theme.muted};">Privacidad</a> &nbsp;·&nbsp; <a href="${escapeHtml(termsUrl)}" style="color:${theme.muted};">Términos</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // La versión de solo texto: la ven quienes no abren HTML y los filtros de
  // spam la valoran. Mismo contenido, sin diseño.
  const text = [
    content.heading,
    "",
    ...content.paragraphs.flatMap((paragraph) => [
      toInlines(paragraph).map(inlineToText).join(""),
      "",
    ]),
    ...(content.action
      ? [`${content.action.label}: ${content.action.url}`, ""]
      : []),
    ...(content.notes ?? []).flatMap((note) => [note]),
    ...(content.notes?.length ? [""] : []),
    ...(content.aside ? [content.aside, ""] : []),
    "—",
    content.reason,
    `¿Necesitas ayuda? Responde a este correo o escribe a ${contact}.`,
    `Privacidad: ${privacyUrl} · Términos: ${termsUrl}`,
  ].join("\n");

  return { html, text };
};
