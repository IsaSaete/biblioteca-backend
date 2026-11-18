import { renderEmail } from "../renderEmail.js";
import { escapeHtml, toSingleLine } from "../escapeHtml.js";

const base = {
  preheader: "Resumen visible en la bandeja",
  heading: "Un título",
  paragraphs: ["Primer párrafo.", ["Con ", { strong: "negrita" }, " dentro."]],
  reason: "Te escribimos porque hay una cuenta con esta dirección.",
};

describe("Given the common layout of the emails of Glosa", () => {
  describe("When an email with a button and notes is rendered", () => {
    it("Then the HTML has the heading, the paragraphs, the button, the link in text and the footer", () => {
      const { html } = renderEmail({
        ...base,
        action: { label: "Confirmar", url: "https://glosaapp.com/x?token=1" },
        notes: ["Caduca en 24 horas."],
        aside: "Una nota al margen.",
      });

      expect(html).toContain("<h1");
      expect(html).toContain("Un título");
      expect(html).toContain("Primer párrafo.");
      expect(html).toContain("<strong>negrita</strong>");
      expect(html).toContain('href="https://glosaapp.com/x?token=1"');
      expect(html).toContain("Si el botón no funciona");
      expect(html).toContain("Caduca en 24 horas.");
      expect(html).toContain("Una nota al margen.");
      expect(html).toContain("Tu biblioteca personal");
    });

    it("Then it has the dark theme of the app, with the colors that keep the contrast", () => {
      const { html } = renderEmail(base);

      expect(html).toContain("@media (prefers-color-scheme: dark)");
      expect(html).toContain("background-color: #15130F !important");
      expect(html).toContain("background-color: #211E19 !important");
      expect(html).toContain("color: #F2ECE4 !important");
      expect(html).toContain("background-color: #E08A5F !important");
      expect(html).toContain("color: #15130F !important");
    });

    it("Then the links keep the accent color in the dark theme instead of the muted one", () => {
      const { html } = renderEmail(base);
      const rules = html.slice(
        html.indexOf("<style>"),
        html.indexOf("</style>"),
      );

      // `.em-muted a` es más específico que `.em-link`: la regla de los enlaces
      // debe igualarlo (`a.em-link`) y ir después, o los pisa.
      expect(rules).toContain("a.em-link { color: #E08A5F !important; }");
      expect(rules.indexOf(".em-muted a")).toBeLessThan(
        rules.indexOf("a.em-link"),
      );
    });

    it("Then the elements that change in the dark theme carry the classes it targets", () => {
      const { html } = renderEmail({
        ...base,
        action: { label: "Ir", url: "https://glosaapp.com/x" },
        aside: "Glosa.",
      });

      for (const name of [
        "em-bg",
        "em-card",
        "em-text",
        "em-muted",
        "em-link",
        "em-btn",
        "em-btn-text",
        "em-note",
        "em-tag",
        "em-line-b",
        "em-line-t",
      ]) {
        expect(html).toContain(name);
      }
    });

    it("Then the button is centered", () => {
      const { html } = renderEmail({
        ...base,
        action: { label: "Confirmar", url: "https://glosaapp.com/x" },
      });

      expect(html).toMatch(
        /<table[^>]*align="center"[^>]*>\s*<tr>\s*<td class="em-btn" bgcolor="#AA5936"/,
      );
    });

    it("Then the header links to the site and shows the brand once, with the tagline beside it", () => {
      const { html } = renderEmail(base);

      expect(html).toMatch(
        /<a href="[^"]+" style="text-decoration:none;">\s*<table/,
      );
      expect(html.match(/Tu biblioteca personal/g)).toHaveLength(1);
    });

    it("Then the footer says why the email was sent, how to get help and where the legal texts are", () => {
      const { html, text } = renderEmail(base);

      expect(html).toContain(
        "Te escribimos porque hay una cuenta con esta dirección.",
      );
      expect(html).toContain("¿Necesitas ayuda? Responde a este correo");
      expect(html).toContain("/privacy");
      expect(html).toContain("/terms");
      expect(html).toContain("mailto:");
      expect(text).toContain(
        "Te escribimos porque hay una cuenta con esta dirección.",
      );
      expect(text).toContain("/terms");
    });

    it("Then it declares its language, both color schemes and the preheader", () => {
      const { html } = renderEmail(base);

      expect(html).toContain('<html lang="es">');
      expect(html).toContain('name="color-scheme" content="light dark"');
      expect(html).toContain("Resumen visible en la bandeja");
    });

    it("Then the plain text version has the same content without markup", () => {
      const { text } = renderEmail({
        ...base,
        action: { label: "Confirmar", url: "https://glosaapp.com/x?token=1" },
        notes: ["Caduca en 24 horas."],
      });

      expect(text).toContain("Un título");
      expect(text).toContain("Con negrita dentro.");
      expect(text).toContain("Confirmar: https://glosaapp.com/x?token=1");
      expect(text).toContain("Caduca en 24 horas.");
      expect(text).not.toMatch(/<[a-z]/i);
    });
  });

  describe("When an email has no button", () => {
    it("Then no button or link fallback is rendered", () => {
      const { html } = renderEmail(base);

      expect(html).not.toContain("Si el botón no funciona");
      expect(html).not.toContain('bgcolor="#AA5936"');
    });
  });

  describe("When the content has characters that mean something in HTML", () => {
    it("Then they are escaped everywhere, as the content is never interpreted as HTML", () => {
      const { html } = renderEmail({
        preheader: "<b>x</b>",
        heading: "<script>alert(1)</script>",
        paragraphs: ["a < b & c", ["x ", { strong: '"><img src=x>' }]],
        action: { label: "<i>Ir</i>", url: 'https://glosaapp.com/?a="1"&b=2' },
        notes: ["<u>nota</u>"],
        aside: "<em>glosa</em>",
        reason: "<b>motivo</b>",
      });

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img src=x>");
      expect(html).not.toContain("<i>Ir</i>");
      expect(html).not.toContain("<u>nota</u>");
      expect(html).not.toContain("<b>motivo</b>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("a &lt; b &amp; c");
      expect(html).toContain("&quot;&gt;&lt;img src=x&gt;");
    });
  });
});

describe("Given the escaping helpers", () => {
  describe("When a text has the five characters that need escaping", () => {
    it("Then each one is replaced by its entity", () => {
      expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    });
  });

  describe("When a text for an email subject has line breaks", () => {
    it("Then they become spaces and the ends are trimmed", () => {
      expect(toSingleLine("  uno\r\ndos\ntres  ")).toBe("uno dos tres");
    });
  });
});
