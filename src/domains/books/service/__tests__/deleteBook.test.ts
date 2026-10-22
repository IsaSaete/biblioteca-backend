import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import Quote from "../../../quotes/model/Quote.js";
import QuotesService from "../../../quotes/service/QuotesService.js";
import BooksService from "../BooksService.js";
import { buildCreateBookDto } from "../../fixtures/books.fixtures.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
  await Quote.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const newUserId = (): string => new Types.ObjectId().toString();

describe("Given the BooksService.deleteBook function", () => {
  describe("When the user deletes a book that another user also has", () => {
    it("Then it should remove only their Ejemplar and keep the Book and the other Ejemplar", async () => {
      const userA = newUserId();
      const userB = newUserId();
      const { book } = await BooksService.createBook(
        userA,
        buildCreateBookDto(),
      );
      await BooksService.createBook(userB, buildCreateBookDto());

      await BooksService.deleteBook(userA, book.id);

      expect(await Ejemplar.countDocuments({ userId: userA })).toBe(0);
      expect(await Ejemplar.countDocuments({ userId: userB })).toBe(1);
      expect(await Book.findById(book.id)).not.toBeNull();
    });
  });

  describe("When the book has quotes", () => {
    it("Then it should delete the quotes of that Ejemplar and keep the rest", async () => {
      const userId = newUserId();
      const other = await BooksService.createBook(userId, buildCreateBookDto());
      const deleted = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: undefined, title: "Otro libro" }),
      );
      await QuotesService.createQuote(userId, {
        ejemplarId: other.ejemplar.id,
        text: "Se queda",
      });
      await QuotesService.createQuote(userId, {
        ejemplarId: deleted.ejemplar.id,
        text: "Se va",
      });

      await BooksService.deleteBook(userId, deleted.book.id);

      const remaining = await Quote.find();
      expect(remaining.map((quote) => quote.text)).toEqual(["Se queda"]);
    });
  });

  describe("When the user deletes a book and adds it again", () => {
    it("Then it should create a fresh Ejemplar without the previous data", async () => {
      const userId = newUserId();
      const { book } = await BooksService.createBook(
        userId,
        buildCreateBookDto(),
      );
      await BooksService.updateEjemplar(userId, book.id, {
        favorite: true,
        notes: "Nota",
      });
      await BooksService.deleteBook(userId, book.id);

      const again = await BooksService.createBook(userId, buildCreateBookDto());

      expect(again.ejemplar.favorite).toBe(false);
      expect(again.ejemplar).not.toHaveProperty("notes");
    });
  });

  describe("When the book belongs only to another user", () => {
    it("Then it should throw BOOK_NOT_FOUND and keep their Ejemplar", async () => {
      const { book } = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );

      await expect(
        BooksService.deleteBook(newUserId(), book.id),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
      expect(await Ejemplar.countDocuments()).toBe(1);
    });
  });

  describe("When the id is not a valid ObjectId", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      await expect(
        BooksService.deleteBook(newUserId(), "no-es-un-id"),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });
});
