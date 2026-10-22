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

const addBook = (userId: string, title: string, authors: string[]) =>
  BooksService.createBook(userId, buildManualBookDto({ title, authors }));

const searchTitles = async (userId: string, search: string) => {
  const page = await BooksService.listLibrary(userId, { search });

  return page.items.map((item) => item.book.title);
};

describe("Given the BooksService.listLibrary function with search", () => {
  describe("When the term is part of a title", () => {
    it("Then it should return only the matching books, ignoring case and accents", async () => {
      const userId = newUserId();
      await addBook(userId, "Cien años de soledad", ["Gabriel García Márquez"]);
      await addBook(userId, "Ficciones", ["Jorge Luis Borges"]);

      expect(await searchTitles(userId, "ANOS de")).toEqual([
        "Cien años de soledad",
      ]);
    });
  });

  describe("When the term is part of an author", () => {
    it("Then it should match by author, also with several words in any order", async () => {
      const userId = newUserId();
      await addBook(userId, "Cien años de soledad", ["Gabriel García Márquez"]);
      await addBook(userId, "Ficciones", ["Jorge Luis Borges"]);

      expect(await searchTitles(userId, "marquez garcia")).toEqual([
        "Cien años de soledad",
      ]);
    });
  });

  describe("When the term is one of the tags of the Ejemplar", () => {
    it("Then it should match by tag", async () => {
      const userId = newUserId();
      const { book } = await addBook(userId, "Ficciones", [
        "Jorge Luis Borges",
      ]);
      await addBook(userId, "Otro libro", ["Autora Anónima"]);
      await BooksService.updateEjemplar(userId, book.id, {
        tags: ["Cuentos", "Argentina"],
      });

      expect(await searchTitles(userId, "argentina")).toEqual(["Ficciones"]);
    });
  });

  describe("When the Ejemplar overrides the title and the authors", () => {
    it("Then it should search the overridden values, not the original ones", async () => {
      const userId = newUserId();
      const { book } = await addBook(userId, "Título original", [
        "Autor Viejo",
      ]);
      await BooksService.updateEjemplar(userId, book.id, {
        overrides: { title: "Título corregido", authors: ["Autora Nueva"] },
      });

      expect(await searchTitles(userId, "corregido")).toEqual([
        "Título original",
      ]);
      expect(await searchTitles(userId, "nueva")).toHaveLength(1);
      expect(await searchTitles(userId, "original")).toEqual([]);
      expect(await searchTitles(userId, "viejo")).toEqual([]);
    });
  });

  describe("When the term has regex special characters", () => {
    it("Then it should search them as plain text", async () => {
      const userId = newUserId();
      await addBook(userId, "Manual de C++", ["Autor"]);
      await addBook(userId, "Otro", ["Autor"]);

      expect(await searchTitles(userId, "c++")).toEqual(["Manual de C++"]);
      expect(await searchTitles(userId, ".*")).toEqual([]);
    });
  });

  describe("When the search is empty or only spaces", () => {
    it("Then it should return the whole library", async () => {
      const userId = newUserId();
      await addBook(userId, "Uno", ["A"]);
      await addBook(userId, "Dos", ["B"]);

      expect(await searchTitles(userId, "   ")).toHaveLength(2);
    });
  });

  describe("When another user has a matching book", () => {
    it("Then it should not be returned", async () => {
      await addBook(newUserId(), "Ficciones", ["Jorge Luis Borges"]);

      expect(await searchTitles(newUserId(), "ficciones")).toEqual([]);
    });
  });

  describe("When the search has more than 100 characters", () => {
    it("Then it should throw VALIDATION_ERROR on search", async () => {
      await expect(
        BooksService.listLibrary(newUserId(), { search: "a".repeat(101) }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "search" });
    });
  });

  describe("When the matches are more than one page and the cursor is used", () => {
    it("Then it should paginate only the matching books", async () => {
      const userId = newUserId();
      for (let index = 0; index < 25; index += 1) {
        await addBook(userId, `Poesía ${index}`, ["Autora"]);
      }
      await addBook(userId, "Novela", ["Autora"]);

      const first = await BooksService.listLibrary(userId, {
        search: "poesia",
      });
      const second = await BooksService.listLibrary(userId, {
        search: "poesia",
        cursor: first.nextCursor,
      });

      expect(first.items).toHaveLength(24);
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
    });
  });
});
