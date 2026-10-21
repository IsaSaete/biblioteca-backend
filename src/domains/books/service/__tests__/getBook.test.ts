import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import BooksService from "../BooksService.js";
import { buildCreateBookDto } from "../../fixtures/books.fixtures.js";

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

describe("Given the BooksService.getBook function", () => {
  describe("When the user has that book", () => {
    it("Then it should return the book and the user's ejemplar", async () => {
      const userId = newUserId();
      const created = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );

      const item = await BooksService.getBook(userId, created.book.id);

      expect(item).toEqual(created);
    });
  });

  describe("When the user corrected the book when adding it", () => {
    it("Then the ejemplar should carry the overrides and the book stay untouched", async () => {
      const original = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );
      const userId = newUserId();
      await BooksService.createBook(
        userId,
        buildCreateBookDto({ title: "Título corregido" }),
      );

      const item = await BooksService.getBook(userId, original.book.id);

      expect(item.book.title).toBe(original.book.title);
      expect(item.ejemplar.overrides).toEqual({ title: "Título corregido" });
    });
  });

  describe("When the book belongs only to another user", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      const created = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );

      await expect(
        BooksService.getBook(newUserId(), created.book.id),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });

  describe("When the id is not a valid ObjectId", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      await expect(
        BooksService.getBook(newUserId(), "no-es-un-id"),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });
});
