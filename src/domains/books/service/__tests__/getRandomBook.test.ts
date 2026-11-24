import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import BooksService from "../BooksService.js";
import {
  ISBN_13,
  OTHER_EDITION_ISBN_13,
  buildCreateBookDto,
} from "../../fixtures/books.fixtures.js";

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

const addBook = async (userId: string, isbn: string, title: string) =>
  BooksService.createBook(userId, buildCreateBookDto({ isbn, title }));

describe("Given the BooksService.getRandomBook function", () => {
  describe("When the user has books", () => {
    it("Then it should return one of them with their ejemplar", async () => {
      const userId = newUserId();
      const added = await addBook(userId, ISBN_13, "Primero");

      const item = await BooksService.getRandomBook(userId, {});

      expect(item).toEqual(added);
    });

    it("Then, over several calls, it should not always return the same one", async () => {
      const userId = newUserId();
      await addBook(userId, ISBN_13, "Primero");
      await addBook(userId, OTHER_EDITION_ISBN_13, "Segundo");

      const ids = new Set<string>();

      for (let attempt = 0; attempt < 30; attempt += 1) {
        ids.add((await BooksService.getRandomBook(userId, {})).book.id);
      }

      expect(ids.size).toBe(2);
    });
  });

  describe("When another user has books but this one has none", () => {
    it("Then it should fail with BOOK_NOT_FOUND without touching the others' books", async () => {
      await addBook(newUserId(), ISBN_13, "De otra persona");

      await expect(
        BooksService.getRandomBook(newUserId(), {}),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });

  describe("When a book is lent", () => {
    it("Then it should never be suggested", async () => {
      const userId = newUserId();
      const lent = await addBook(userId, ISBN_13, "Prestado");
      const onShelf = await addBook(userId, OTHER_EDITION_ISBN_13, "En casa");
      await BooksService.updateEjemplar(userId, lent.book.id, {
        loan: { borrowerName: "Ana" },
      });

      for (let attempt = 0; attempt < 15; attempt += 1) {
        const item = await BooksService.getRandomBook(userId, {});

        expect(item.book.id).toBe(onShelf.book.id);
      }
    });

    it("Then, if every book is lent, it should fail with BOOK_NOT_FOUND", async () => {
      const userId = newUserId();
      const lent = await addBook(userId, ISBN_13, "Prestado");
      await BooksService.updateEjemplar(userId, lent.book.id, {
        loan: { borrowerName: "Ana" },
      });

      await expect(
        BooksService.getRandomBook(userId, {}),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });

  describe("When a book is excluded", () => {
    it("Then it should return another one", async () => {
      const userId = newUserId();
      const first = await addBook(userId, ISBN_13, "Primero");
      const second = await addBook(userId, OTHER_EDITION_ISBN_13, "Segundo");

      for (let attempt = 0; attempt < 15; attempt += 1) {
        const item = await BooksService.getRandomBook(userId, {
          exclude: first.book.id,
        });

        expect(item.book.id).toBe(second.book.id);
      }
    });

    it("Then, if it is the only book, it should fail with BOOK_NOT_FOUND", async () => {
      const userId = newUserId();
      const only = await addBook(userId, ISBN_13, "Único");

      await expect(
        BooksService.getRandomBook(userId, { exclude: only.book.id }),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });

    it("Then an invalid id should fail with VALIDATION_ERROR on exclude", async () => {
      await expect(
        BooksService.getRandomBook(newUserId(), { exclude: "no-es-un-id" }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "exclude",
      });
    });
  });
});
