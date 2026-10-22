// Letras base con sus variantes acentuadas: Mongo no compara sin tildes dentro
// de una expresión regular, así que cada letra del texto buscado se expande.
const ACCENT_VARIANTS: Record<string, string> = {
  a: "aàáâãäå",
  e: "eèéêë",
  i: "iìíîï",
  o: "oòóôõö",
  u: "uùúûü",
  n: "nñ",
  c: "cç",
};

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripAccents = (text: string): string =>
  text.normalize("NFD").replace(/\p{M}/gu, "");

// Patrón (para usar con la opción «i») que encuentra el texto sin distinguir
// mayúsculas ni tildes.
const buildSearchPattern = (term: string): string =>
  [...stripAccents(term).toLowerCase()]
    .map((char) => {
      const variants = ACCENT_VARIANTS[char];

      return variants ? `[${variants}]` : escapeRegex(char);
    })
    .join("");

export default buildSearchPattern;
