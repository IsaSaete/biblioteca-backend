import "dotenv/config";
import mongoose from "mongoose";
import connectToDatabase from "../database/connectToDatabase.js";
import Book from "../domains/books/model/Book.js";
import planGenreMigration from "../domains/books/utils/planGenreMigration.js";

// Deja en cada libro compartido un único género del catálogo (ver
// `selectGenre`). Por defecto es una PRUEBA: lee y enseña qué cambiaría, sin
// escribir nada. Solo con `--apply` escribe. No toca las correcciones de cada
// ejemplar (`Ejemplar.overrides`): esas las eligió la persona.
//
//   npm run migrate:genres             # prueba
//   npm run migrate:genres -- --apply  # aplica (haz antes una copia en Atlas)
const shouldApply = process.argv.includes("--apply");

const write = (line = ""): void => {
  process.stdout.write(`${line}\n`);
};

const run = async (): Promise<void> => {
  await connectToDatabase();
  const { host, name } = mongoose.connection;

  write(
    shouldApply
      ? "=== APLICANDO CAMBIOS ==="
      : "=== PRUEBA: no se escribe nada ===",
  );
  write(`Base de datos: ${name} (${host})`);

  const books = await Book.find({ "categories.0": { $exists: true } })
    .select("title categories")
    .lean();
  const { changes, unchangedCount } = planGenreMigration(
    books.map((book) => ({
      id: book._id.toString(),
      title: book.title,
      categories: book.categories ?? [],
    })),
  );

  write(`Libros con géneros: ${books.length}`);
  write(`Sin cambios: ${unchangedCount}`);
  write(`Con cambios: ${changes.length}`);
  write();

  for (const change of changes) {
    write(`- ${change.title}`);
    write(`    antes:   ${change.before.join(" | ")}`);
    write(`    después: ${change.after.join(" | ") || "(ninguno)"}`);
    if (change.unmapped.length > 0) {
      write(`    descartado: ${change.unmapped.join(" | ")}`);
    }
  }

  const discarded = new Map<string, number>();

  for (const { unmapped } of changes) {
    for (const category of unmapped) {
      discarded.set(category, (discarded.get(category) ?? 0) + 1);
    }
  }

  if (discarded.size > 0) {
    write();
    write("Categorías descartadas (para ampliar el diccionario):");
    [...discarded.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => write(`  ${count} × ${category}`));
  }

  write();

  if (!shouldApply) {
    write(
      "No se ha escrito nada. Para aplicar: npm run migrate:genres -- --apply",
    );
    return;
  }

  if (changes.length > 0) {
    const result = await Book.bulkWrite(
      changes.map(({ id, after }) => ({
        updateOne: {
          filter: { _id: id },
          update:
            after.length > 0
              ? { $set: { categories: after } }
              : { $unset: { categories: "" } },
        },
      })),
    );

    write(`Libros actualizados: ${result.modifiedCount}`);
  }
};

try {
  await run();
} finally {
  await mongoose.disconnect();
}
