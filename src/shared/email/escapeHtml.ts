// Todo texto que llega de una persona (su nombre, su email) se escapa antes de
// entrar en el HTML de un correo que enviamos nosotros: sin esto, un nombre como
// `<a href="…">` se colaría como código en el correo.
const REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => REPLACEMENTS[character] ?? character);

// Un asunto no admite saltos de línea (permitirlos serviría para inyectar
// cabeceras): se pasan a un espacio.
export const toSingleLine = (text: string): string =>
  text.replace(/[\r\n]+/g, " ").trim();
