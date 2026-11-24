// Los catálogos a veces mandan las primeras palabras de la sinopsis en
// mayúsculas («LA NOVELA QUE TODOS ESPERABAN es…») o toda la sinopsis. Se
// pasan a minúsculas con la inicial de cada frase en mayúscula. No se toca
// ninguna sigla suelta en medio del texto (ONU, ISBN), ni un único término en
// mayúsculas al principio, porque puede ser una sigla.
const MIN_SHOUTED_WORDS = 2;
const MIN_LETTERS = 2;

const isShouted = (token: string): boolean => {
  const letters = token.replace(/[^\p{L}]/gu, "");

  return (
    letters.length >= MIN_LETTERS &&
    letters === letters.toUpperCase() &&
    letters !== letters.toLowerCase()
  );
};

const toSentenceCase = (text: string): string =>
  text
    .toLowerCase()
    .replace(/(^|[.!?¡¿]\s+)(\p{L})/gu, (_, start: string, letter: string) => {
      return `${start}${letter.toUpperCase()}`;
    })
    .replace(/^(\P{L}*)(\p{L})/u, (_, start: string, letter: string) => {
      return `${start}${letter.toUpperCase()}`;
    });

const normalizeSynopsis = (synopsis: string): string => {
  const text = synopsis.trim();
  const tokens = text.split(/(\s+)/);
  const words = tokens.filter((token) => token.trim() !== "");

  if (words.length === 0) {
    return text;
  }

  if (words.every((word) => !/\p{Ll}/u.test(word))) {
    return toSentenceCase(text);
  }

  let end = 0;
  let shouted = 0;
  for (const [index, token] of tokens.entries()) {
    if (token.trim() === "") {
      continue;
    }
    if (!isShouted(token)) {
      break;
    }
    shouted += 1;
    end = index + 1;
  }

  if (shouted < MIN_SHOUTED_WORDS) {
    return text;
  }

  return (
    toSentenceCase(tokens.slice(0, end).join("")) + tokens.slice(end).join("")
  );
};

export default normalizeSynopsis;
