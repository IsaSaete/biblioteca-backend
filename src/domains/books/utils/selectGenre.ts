import {
  GENERIC_GENRES,
  GENRE_ALIASES,
  GENRE_KEYWORD_RULES,
  GENRES,
} from "./genres.js";
import type { Genre } from "./genres.js";

const normalizeText = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Cada género del catálogo se reconoce a sí mismo, así que normalizar dos veces
// da lo mismo que una.
const aliasToGenre: ReadonlyMap<string, Genre> = new Map(
  GENRES.flatMap((genre) =>
    [genre, ...GENRE_ALIASES[genre]].map((alias): [string, Genre] => [
      normalizeText(alias),
      genre,
    ]),
  ),
);

const resolveText = (text: string): Genre | undefined =>
  aliasToGenre.get(text) ??
  GENRE_KEYWORD_RULES.find(([pattern]) => pattern.test(text))?.[1];

// Una categoría puede venir como jerarquía («Fiction / Fantasy / General») o
// con matices tras una coma («Detective and mystery stories, Spanish»). Se
// prueba entera y, si no basta, por tramos del más específico (el último) al
// más general; «General» no dice nada y se salta.
const resolveCategory = (category: string): Genre | undefined => {
  const whole = normalizeText(category);
  const wholeMatch = aliasToGenre.get(whole);

  if (wholeMatch) {
    return wholeMatch;
  }

  const parts = whole
    .split(/[/,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "general");

  for (const part of parts.reverse()) {
    const match = resolveText(part);

    if (match) {
      return match;
    }
  }

  return undefined;
};

export interface SelectedGenre {
  genre?: Genre;
  // Categorías que no son un género conocido: se descartan y se registran para
  // ampliar el diccionario con datos reales.
  unmapped: string[];
}

// De las categorías que da un proveedor deja un único género del catálogo: el
// primero específico, o «Ficción» si es lo único que hay.
const selectGenre = (categories: readonly string[]): SelectedGenre => {
  const resolved = categories.map((category) => ({
    category,
    genre: resolveCategory(category),
  }));
  const genres = resolved.flatMap(({ genre }) => (genre ? [genre] : []));

  return {
    genre: genres.find((genre) => !GENERIC_GENRES.includes(genre)) ?? genres[0],
    unmapped: resolved.flatMap(({ category, genre }) =>
      genre ? [] : [category],
    ),
  };
};

export default selectGenre;
