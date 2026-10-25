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
  tags: string[] = [],
): Promise<void> => {
  const { book } = await BooksService.createBook(
    userId,
    buildManualBookDto({ title }),
  );

  if (tags.length > 0) {
    await BooksService.updateEjemplar(userId, book.id, { tags });
  }
};

describe("Given the BooksService.listTags function", () => {
  describe("When the user has no books", () => {
    it("Then it should return no tags and untaggedCount 0", async () => {
      expect(await BooksService.listTags(newUserId())).toEqual({
        items: [],
        untaggedCount: 0,
      });
    });
  });

  describe("When the user has tagged and untagged books", () => {
    it("Then it should list each tag with its number of books, most used first, and count the untagged ones", async () => {
      const userId = newUserId();
      await addBook(userId, "Uno", ["Historia", "Ensayo"]);
      await addBook(userId, "Dos", ["Historia"]);
      await addBook(userId, "Tres", ["Poesía"]);
      await addBook(userId, "Cuatro");

      expect(await BooksService.listTags(userId)).toEqual({
        items: [
          { tag: "Historia", count: 2 },
          { tag: "Ensayo", count: 1 },
          { tag: "Poesía", count: 1 },
        ],
        untaggedCount: 1,
      });
    });
  });

  describe("When the same tag is written with different case", () => {
    it("Then it should group them and show the most used spelling", async () => {
      const userId = newUserId();
      await addBook(userId, "Uno", ["sci-fi"]);
      await addBook(userId, "Dos", ["Sci-Fi"]);
      await addBook(userId, "Tres", ["Sci-Fi"]);

      expect((await BooksService.listTags(userId)).items).toEqual([
        { tag: "Sci-Fi", count: 3 },
      ]);
    });
  });

  describe("When two tags have the same number of books", () => {
    it("Then it should sort them alphabetically ignoring accents and case", async () => {
      const userId = newUserId();
      await addBook(userId, "Uno", ["Zoología", "ápices", "Biología"]);

      expect(
        (await BooksService.listTags(userId)).items.map((item) => item.tag),
      ).toEqual(["ápices", "Biología", "Zoología"]);
    });
  });

  describe("When a book had tags and the user removed them all", () => {
    it("Then it should count as untagged", async () => {
      const userId = newUserId();
      const { book } = await BooksService.createBook(
        userId,
        buildManualBookDto(),
      );
      await BooksService.updateEjemplar(userId, book.id, {
        tags: ["Historia"],
      });
      await BooksService.updateEjemplar(userId, book.id, { tags: [] });

      expect(await BooksService.listTags(userId)).toEqual({
        items: [],
        untaggedCount: 1,
      });
    });
  });

  describe("When another user has tagged books", () => {
    it("Then their tags should not appear", async () => {
      await addBook(newUserId(), "Ajeno", ["Historia"]);

      expect(await BooksService.listTags(newUserId())).toEqual({
        items: [],
        untaggedCount: 0,
      });
    });
  });
});
