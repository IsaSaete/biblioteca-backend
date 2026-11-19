// Longitudes máximas de los textos que una usuaria puede guardar. Son holgadas:
// ningún libro real las alcanza, pero impiden llenar la base de datos (el plan
// gratuito de Atlas tiene 512 MB) o el catálogo compartido con textos enormes.
// El cuerpo de cualquier petición ya está limitado a 100 KB.
export const FIELD_LIMITS = {
  title: 500,
  author: 300,
  authors: 50,
  publisher: 300,
  language: 20,
  synopsis: 20_000,
  category: 200,
  categories: 50,
  location: 200,
  notes: 5_000,
  tag: 50,
  coverUrl: 2_000,
} as const;

const tooLong = (what: string, max: number) =>
  `${what} no puede tener más de ${max} caracteres`;

export const messages = {
  title: tooLong("El título", FIELD_LIMITS.title),
  author: tooLong("El nombre del autor", FIELD_LIMITS.author),
  authors: `Indica como máximo ${FIELD_LIMITS.authors} autores`,
  publisher: tooLong("La editorial", FIELD_LIMITS.publisher),
  language: tooLong("El idioma", FIELD_LIMITS.language),
  synopsis: tooLong("La sinopsis", FIELD_LIMITS.synopsis),
  category: tooLong("La categoría", FIELD_LIMITS.category),
  categories: `Indica como máximo ${FIELD_LIMITS.categories} categorías`,
  location: tooLong("La ubicación", FIELD_LIMITS.location),
  notes: tooLong("La nota", FIELD_LIMITS.notes),
  tag: tooLong("La etiqueta", FIELD_LIMITS.tag),
  coverUrl: "La URL de la portada no es válida",
};
