// Colores y tipografías de los correos. Son los de la app (sistema de diseño
// visual) escritos como valores fijos: los clientes de correo no entienden
// variables CSS ni tipografías web, así que cada valor va tal cual en el HTML.
export const emailTheme = {
  paper: "#F7F5F1",
  card: "#FFFFFF",
  text: "#2B2620",
  muted: "#6B6459",
  line: "#E6E0D6",
  lineStrong: "#CFC6B8",
  primary: "#AA5936",
  onPrimary: "#FFFFFF",
  // La nota al margen en cursiva de la landing (las «glosas»).
  note: "#8A4526",
  // Besley y Alegreya no se cargan en un correo: Georgia es la serif más
  // parecida que casi todos los clientes tienen.
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

// El tema oscuro de la app. Lo usan los clientes que lo soportan (Apple Mail y
// parte de Outlook) con `prefers-color-scheme`; el resto muestra el claro o lo
// recolorea por su cuenta. Contrastes: botón 7:1, terracota sobre la tarjeta 6,3:1.
export const emailThemeDark = {
  paper: "#15130F",
  card: "#211E19",
  text: "#F2ECE4",
  muted: "#B8AFA0",
  line: "#322D26",
  lineStrong: "#4A443B",
  primary: "#E08A5F",
  onPrimary: "#15130F",
  note: "#E9A987",
} as const;
