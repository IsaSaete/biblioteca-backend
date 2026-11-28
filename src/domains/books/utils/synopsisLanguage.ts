import { franc } from "franc-min";

export type SynopsisLanguageMatch = "match" | "mismatch" | "unknown";

// Idioma de los proveedores (ISO 639-1) → el que devuelve el detector (639-3).
const DETECTOR_CODES: Record<string, string> = {
  es: "spa",
  en: "eng",
  fr: "fra",
  de: "deu",
  it: "ita",
  pt: "por",
  ca: "cat",
  gl: "glg",
  eu: "eus",
};

// El detector confunde con facilidad lenguas muy cercanas; en esos casos no se
// afirma que el texto esté en otro idioma.
const CLOSE_LANGUAGES: Record<string, string[]> = {
  spa: ["glg", "ast"],
  glg: ["spa", "por"],
  por: ["glg"],
};

// Menos de esto, el detector acierta poco: se da la sinopsis por buena.
const MIN_LENGTH = 40;

// Compara el idioma de la sinopsis con el del libro. Google Books a veces trae
// en la ficha la sinopsis de otra edición, en otro idioma. «unknown» = no se
// puede afirmar (sin idioma del libro, texto corto o idioma no reconocido).
const synopsisLanguageMatch = (
  synopsis: string,
  bookLanguage?: string,
): SynopsisLanguageMatch => {
  const expected = bookLanguage
    ? DETECTOR_CODES[bookLanguage.toLowerCase().slice(0, 2)]
    : undefined;
  const text = synopsis.trim();

  if (!expected || text.length < MIN_LENGTH) {
    return "unknown";
  }

  const detected = franc(text, { minLength: MIN_LENGTH });

  if (detected === "und") {
    return "unknown";
  }

  if (detected === expected) {
    return "match";
  }

  return CLOSE_LANGUAGES[expected]?.includes(detected) ? "unknown" : "mismatch";
};

export default synopsisLanguageMatch;
