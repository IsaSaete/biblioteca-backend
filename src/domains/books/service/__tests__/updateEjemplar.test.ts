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

const addBook = async (userId: string) => {
  const { book } = await BooksService.createBook(userId, buildCreateBookDto());

  return book.id;
};

describe("Given the BooksService.updateEjemplar function", () => {
  describe("When a new Ejemplar is read before any edit", () => {
    it("Then it should not be a favorite and have no personal data", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {});

      expect(ejemplar).toMatchObject({ favorite: false, status: "pending" });
      expect(ejemplar).not.toHaveProperty("notes");
      expect(ejemplar).not.toHaveProperty("tags");
    });
  });

  describe("When personal data is sent", () => {
    it("Then it should save it in the Ejemplar", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {
        status: "read",
        favorite: true,
        location: "Estante 2",
        format: "paperback",
        provenance: "gift",
        acquisitionDate: "2024-12-25",
        notes: "Regalo de Navidad",
        tags: ["novela", "Barcelona"],
      });

      expect(ejemplar).toMatchObject({
        status: "read",
        favorite: true,
        location: "Estante 2",
        format: "paperback",
        provenance: "gift",
        acquisitionDate: "2024-12-25",
        notes: "Regalo de Navidad",
        tags: ["novela", "Barcelona"],
      });
    });
  });

  describe("When a field is sent as null or an empty string", () => {
    it("Then it should clear that field and keep the rest", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);
      await BooksService.updateEjemplar(userId, bookId, {
        location: "Estante 2",
        notes: "Nota",
        format: "pocket",
      });

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {
        location: "",
        format: null,
      });

      expect(ejemplar).not.toHaveProperty("location");
      expect(ejemplar).not.toHaveProperty("format");
      expect(ejemplar.notes).toBe("Nota");
    });
  });

  describe("When tags repeat ignoring case", () => {
    it("Then it should keep the first one only", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {
        tags: ["Sci-Fi", "sci-fi", "clásico"],
      });

      expect(ejemplar.tags).toEqual(["Sci-Fi", "clásico"]);
    });
  });

  describe("When more than 5 tags are sent", () => {
    it("Then it should throw TAG_LIMIT_EXCEEDED on tags and save nothing", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);

      await expect(
        BooksService.updateEjemplar(userId, bookId, {
          favorite: true,
          tags: ["a", "b", "c", "d", "e", "f"],
        }),
      ).rejects.toMatchObject({ code: "TAG_LIMIT_EXCEEDED", field: "tags" });

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {});
      expect(ejemplar.favorite).toBe(false);
    });
  });

  describe("When overrides are sent twice with different fields", () => {
    it("Then it should merge them, remove the null ones and leave the Book untouched", async () => {
      const userId = newUserId();
      const bookId = await addBook(userId);
      const original = await Book.findById(bookId).lean();
      await BooksService.updateEjemplar(userId, bookId, {
        overrides: { title: "Mi título", pageCount: 600 },
      });

      const ejemplar = await BooksService.updateEjemplar(userId, bookId, {
        overrides: { language: "ca", pageCount: null },
      });

      expect(ejemplar.overrides).toEqual({
        title: "Mi título",
        language: "ca",
      });
      expect(await Book.findById(bookId).lean()).toEqual(original);
    });
  });

  describe("When the value is invalid", () => {
    it.each([
      ["format", { format: "ebook" }],
      ["acquisitionDate", { acquisitionDate: "mañana" }],
      ["favorite", { favorite: "sí" }],
      ["overrides.pageCount", { overrides: { pageCount: -3 } }],
    ])("Then it should throw VALIDATION_ERROR on %s", async (field, body) => {
      const userId = newUserId();
      const bookId = await addBook(userId);

      await expect(
        BooksService.updateEjemplar(userId, bookId, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field });
    });
  });

  describe("When the book belongs to another user or the id is malformed", () => {
    it("Then it should throw BOOK_NOT_FOUND", async () => {
      const bookId = await addBook(newUserId());

      await expect(
        BooksService.updateEjemplar(newUserId(), bookId, { favorite: true }),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
      await expect(
        BooksService.updateEjemplar(newUserId(), "no-es-un-id", {}),
      ).rejects.toMatchObject({ code: "BOOK_NOT_FOUND" });
    });
  });
});
