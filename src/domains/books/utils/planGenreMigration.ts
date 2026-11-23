import selectGenre from "./selectGenre.js";

export interface BookGenres {
  id: string;
  title: string;
  categories: readonly string[];
}

export interface GenreChange {
  id: string;
  title: string;
  before: string[];
  // Vacío si ninguna categoría es un género conocido.
  after: string[];
  unmapped: string[];
}

export interface GenreMigrationPlan {
  changes: GenreChange[];
  unchangedCount: number;
}

const isSameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

// Qué cambiaría en cada libro al dejarle un único género del catálogo. No toca
// nada: solo calcula, para poder revisarlo antes de escribir.
const planGenreMigration = (
  books: readonly BookGenres[],
): GenreMigrationPlan => {
  const changes: GenreChange[] = [];
  let unchangedCount = 0;

  for (const { id, title, categories } of books) {
    const { genre, unmapped } = selectGenre(categories);
    const after = genre ? [genre] : [];

    if (isSameList(after, categories)) {
      unchangedCount += 1;
    } else {
      changes.push({ id, title, before: [...categories], after, unmapped });
    }
  }

  return { changes, unchangedCount };
};

export default planGenreMigration;
