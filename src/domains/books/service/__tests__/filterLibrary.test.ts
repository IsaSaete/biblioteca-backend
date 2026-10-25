import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import BooksService from "../BooksService.js";
import { buildManualBookDto } from "../../fixtures/books.fixtures.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const newUserId = (): string => new Types.ObjectId().toString();

const addBook = async (
  userId: string,
  title: string,
  favorite = false,
  tags: string[] = [],
): Promise<void> => {
  const { book } = await BooksService.createBook(
    userId,
    buildManualBookDto({ title }),
  );

  if (favorite || tags.length > 0) {
    await BooksService.updateEjemplar(userId, book.id, {
      ...(favorite && { favorite: true }),
      ...(tags.length > 0 && { tags }),
    });
  }
};

const listTitles = async (userId: string, query: object) => {
  const page = await BooksService.listLibrary(userId, query);

  return page.items.map((item) => item.book.title);
};

describe("Given the BooksService.listLibrary function with favorite", () => {
  describe("When the user filters by favorite=true", () => {
    it("Then it should return only their favorite books", async () => {
      const userId = newUserId();
      await addBook(userId, "Favorito", true);
      await addBook(userId, "Normal");

      expect(await listTitles(userId, { favorite: "true" })).toEqual([
        "Favorito",
      ]);
    });
  });

  describe.each([
    ["favorite=false", { favorite: "false" }],
    ["no favorite parameter", {}],
  ])("When the query has %s", (_case, query) => {
    it("Then it should not filter", async () => {
      const userId = newUserId();
      await addBook(userId, "Favorito", true);
      await addBook(userId, "Normal");

      expect(await listTitles(userId, query)).toHaveLength(2);
    });
  });

  describe("When the user has no favorites", () => {
    it("Then it should return an empty page without error", async () => {
      const userId = newUserId();
      await addBook(userId, "Normal");

      expect(
        await BooksService.listLibrary(userId, { favorite: "true" }),
      ).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When another user has favorite books", () => {
    it("Then they should not appear", async () => {
      await addBook(newUserId(), "Ajeno", true);

      expect(await listTitles(newUserId(), { favorite: "true" })).toEqual([]);
    });
  });

  describe("When favorite is combined with search", () => {
    it("Then both filters should apply", async () => {
      const userId = newUserId();
      await addBook(userId, "Poesía completa", true);
      await addBook(userId, "Poesía menor");
      await addBook(userId, "Novela", true);

      expect(
        await listTitles(userId, { favorite: "true", search: "poesia" }),
      ).toEqual(["Poesía completa"]);
    });
  });

  describe("When the favorites are more than one page and the cursor is used", () => {
    it("Then it should paginate only the favorites", async () => {
      const userId = newUserId();
      for (let index = 0; index < 25; index += 1) {
        await addBook(userId, `Favorito ${index}`, true);
      }
      await addBook(userId, "Normal");

      const first = await BooksService.listLibrary(userId, {
        favorite: "true",
      });
      const second = await BooksService.listLibrary(userId, {
        favorite: "true",
        cursor: first.nextCursor,
      });

      expect(first.items).toHaveLength(24);
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
    });
  });

  describe("When favorite has an unknown value", () => {
    it("Then it should throw VALIDATION_ERROR on favorite", async () => {
      await expect(
        BooksService.listLibrary(newUserId(), { favorite: "quizás" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "favorite" });
    });
  });
});

describe("Given the BooksService.listLibrary function with tag", () => {
  describe("When the user filters by a tag", () => {
    it("Then it should return only the books with that tag, ignoring case", async () => {
      const userId = newUserId();
      await addBook(userId, "Con etiqueta", false, ["Ciencia ficción", "Otra"]);
      await addBook(userId, "Con otra", false, ["Historia"]);
      await addBook(userId, "Sin etiquetas");

      expect(await listTitles(userId, { tag: "ciencia FICCIÓN" })).toEqual([
        "Con etiqueta",
      ]);
    });
  });

  describe("When the tag is only a part of another tag", () => {
    it("Then it should not match, because the whole tag is compared", async () => {
      const userId = newUserId();
      await addBook(userId, "Libro", false, ["Ciencia ficción"]);

      expect(await listTitles(userId, { tag: "ciencia" })).toEqual([]);
    });
  });

  describe("When the tag has regex special characters", () => {
    it("Then it should be compared as plain text", async () => {
      const userId = newUserId();
      await addBook(userId, "Programación", false, ["C++"]);
      await addBook(userId, "Otro", false, ["Historia"]);

      expect(await listTitles(userId, { tag: "C++" })).toEqual([
        "Programación",
      ]);
      expect(await listTitles(userId, { tag: ".*" })).toEqual([]);
    });
  });

  describe("When the tag is empty or only spaces", () => {
    it("Then it should not filter", async () => {
      const userId = newUserId();
      await addBook(userId, "Uno", false, ["A"]);
      await addBook(userId, "Dos");

      expect(await listTitles(userId, { tag: "   " })).toHaveLength(2);
    });
  });

  describe("When another user has books with that tag", () => {
    it("Then they should not appear", async () => {
      await addBook(newUserId(), "Ajeno", false, ["Historia"]);

      expect(await listTitles(newUserId(), { tag: "Historia" })).toEqual([]);
    });
  });

  describe("When tag is combined with favorite and search", () => {
    it("Then all the filters should apply", async () => {
      const userId = newUserId();
      await addBook(userId, "Poesía completa", true, ["Poesía"]);
      await addBook(userId, "Poesía menor", false, ["Poesía"]);
      await addBook(userId, "Poesía otra", true, ["Ensayo"]);

      expect(
        await listTitles(userId, {
          tag: "poesía",
          favorite: "true",
          search: "poesia",
        }),
      ).toEqual(["Poesía completa"]);
    });
  });

  describe("When the tag has more than 100 characters", () => {
    it("Then it should throw VALIDATION_ERROR on tag", async () => {
      await expect(
        BooksService.listLibrary(newUserId(), { tag: "a".repeat(101) }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "tag" });
    });
  });
});

describe("Given the BooksService.listLibrary function with untagged", () => {
  describe("When the user filters by untagged=true", () => {
    it("Then it should return only the books without any tag", async () => {
      const userId = newUserId();
      await addBook(userId, "Con etiqueta", false, ["Historia"]);
      await addBook(userId, "Sin etiquetas");

      expect(await listTitles(userId, { untagged: "true" })).toEqual([
        "Sin etiquetas",
      ]);
    });
  });

  describe("When a book had tags and the user removed them all", () => {
    it("Then it should count as untagged", async () => {
      const userId = newUserId();
      const { book } = await BooksService.createBook(
        userId,
        buildManualBookDto({ title: "Se quedó sin etiquetas" }),
      );
      await BooksService.updateEjemplar(userId, book.id, {
        tags: ["Historia"],
      });
      await BooksService.updateEjemplar(userId, book.id, { tags: [] });

      expect(await listTitles(userId, { untagged: "true" })).toEqual([
        "Se quedó sin etiquetas",
      ]);
    });
  });

  describe("When untagged is false", () => {
    it("Then it should not filter", async () => {
      const userId = newUserId();
      await addBook(userId, "Con etiqueta", false, ["Historia"]);
      await addBook(userId, "Sin etiquetas");

      expect(await listTitles(userId, { untagged: "false" })).toHaveLength(2);
    });
  });

  describe("When every book has tags", () => {
    it("Then it should return an empty page without error", async () => {
      const userId = newUserId();
      await addBook(userId, "Con etiqueta", false, ["Historia"]);

      expect(
        await BooksService.listLibrary(userId, { untagged: "true" }),
      ).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When another user has books without tags", () => {
    it("Then they should not appear", async () => {
      await addBook(newUserId(), "Ajeno");

      expect(await listTitles(newUserId(), { untagged: "true" })).toEqual([]);
    });
  });

  describe("When untagged is combined with favorite", () => {
    it("Then both filters should apply", async () => {
      const userId = newUserId();
      await addBook(userId, "Favorito sin etiquetas", true);
      await addBook(userId, "Normal sin etiquetas");
      await addBook(userId, "Favorito con etiqueta", true, ["Historia"]);

      expect(
        await listTitles(userId, { untagged: "true", favorite: "true" }),
      ).toEqual(["Favorito sin etiquetas"]);
    });
  });

  describe("When untagged is combined with tag", () => {
    it("Then it should throw VALIDATION_ERROR on untagged", async () => {
      await expect(
        BooksService.listLibrary(newUserId(), {
          untagged: "true",
          tag: "Historia",
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "untagged" });
    });
  });

  describe("When untagged has an unknown value", () => {
    it("Then it should throw VALIDATION_ERROR on untagged", async () => {
      await expect(
        BooksService.listLibrary(newUserId(), { untagged: "quizás" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "untagged" });
    });
  });
});

describe("Given the BooksService.listLibrary function and the total", () => {
  describe("When the library has more books than one page", () => {
    it("Then total should be the whole library on every page", async () => {
      const userId = newUserId();
      for (let index = 0; index < 25; index += 1) {
        await addBook(userId, `Libro ${index}`);
      }

      const first = await BooksService.listLibrary(userId, {});
      const second = await BooksService.listLibrary(userId, {
        cursor: first.nextCursor,
      });

      expect(first.total).toBe(25);
      expect(second.items).toHaveLength(1);
      expect(second.total).toBe(25);
    });
  });

  describe("When filters and search are applied", () => {
    it("Then total should count only the books that match all of them", async () => {
      const userId = newUserId();
      await addBook(userId, "Poesía completa", true, ["Poesía"]);
      await addBook(userId, "Poesía menor", false, ["Poesía"]);
      await addBook(userId, "Novela", true);

      const both = await BooksService.listLibrary(userId, {
        favorite: "true",
        search: "poesia",
      });

      expect(both.total).toBe(1);
      expect(
        (await BooksService.listLibrary(userId, { favorite: "true" })).total,
      ).toBe(2);
      expect(
        (await BooksService.listLibrary(userId, { tag: "poesía" })).total,
      ).toBe(2);
      expect(
        (await BooksService.listLibrary(userId, { untagged: "true" })).total,
      ).toBe(1);
    });
  });

  describe("When another user has books", () => {
    it("Then total should not count them", async () => {
      await addBook(newUserId(), "Ajeno");

      expect((await BooksService.listLibrary(newUserId(), {})).total).toBe(0);
    });
  });
});
