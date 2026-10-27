import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import BooksService from "../../../books/service/BooksService.js";
import {
  ISBN_13,
  buildCreateBookDto,
  buildManualBookDto,
} from "../../../books/fixtures/books.fixtures.js";
import WishlistItem from "../../model/WishlistItem.js";
import { buildAddToWishlistDto } from "../../fixtures/wishlist.fixtures.js";
import WishlistService from "../WishlistService.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
  await WishlistItem.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const newUserId = () => new Types.ObjectId().toString();

describe("Given the WishlistService.addToWishlist function", () => {
  describe("When the user saves a book that is not in the catalog yet", () => {
    it("Then it should create the Libro and return the item in the contract shape", async () => {
      const userId = newUserId();

      const item = await WishlistService.addToWishlist(
        userId,
        buildAddToWishlistDto(),
      );

      expect(item).toEqual({
        id: expect.any(String),
        book: expect.objectContaining({
          id: expect.any(String),
          isbn: ISBN_13,
          title: "La sombra del viento",
        }),
        createdAt: expect.any(String),
      });
      expect(item).not.toHaveProperty("note");
      expect(await Book.countDocuments()).toBe(1);
      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
    });

    it("Then it should not create an Ejemplar", async () => {
      const userId = newUserId();

      await WishlistService.addToWishlist(userId, buildAddToWishlistDto());

      expect(await Ejemplar.countDocuments({ userId })).toBe(0);
    });
  });

  describe("When another user already added that ISBN to the catalog", () => {
    it("Then it should link the existing Libro, ignore the data that differs and leave the Libro untouched", async () => {
      const owner = newUserId();
      const { book } = await BooksService.createBook(
        owner,
        buildCreateBookDto(),
      );

      const item = await WishlistService.addToWishlist(
        newUserId(),
        buildAddToWishlistDto({ title: "Otro título", pageCount: 1 }),
      );

      expect(item.book.id).toBe(book.id);
      expect(item.book.title).toBe("La sombra del viento");
      expect(await Book.countDocuments()).toBe(1);
      expect((await Book.findById(book.id))?.pageCount).toBe(576);
    });
  });

  describe("When the user adds a note", () => {
    it("Then it should store it trimmed and return it", async () => {
      const userId = newUserId();

      const item = await WishlistService.addToWishlist(
        userId,
        buildAddToWishlistDto({ note: "  Me lo recomendó Marta  " }),
      );

      expect(item.note).toBe("Me lo recomendó Marta");
      expect((await WishlistItem.findOne({ userId }))?.note).toBe(
        "Me lo recomendó Marta",
      );
    });

    it.each([
      ["empty", ""],
      ["only spaces", "   "],
      ["null", null],
    ])("Then a note that is %s should be left out", async (_case, note) => {
      const item = await WishlistService.addToWishlist(newUserId(), {
        ...buildAddToWishlistDto(),
        note,
      });

      expect(item).not.toHaveProperty("note");
    });
  });

  describe("When the body carries a reading status", () => {
    it("Then it should ignore it", async () => {
      const item = await WishlistService.addToWishlist(newUserId(), {
        ...buildAddToWishlistDto(),
        status: "read",
      });

      expect(item).not.toHaveProperty("status");
    });
  });

  describe("When the book has no ISBN", () => {
    it("Then two different manual books can both be saved", async () => {
      const userId = newUserId();

      await WishlistService.addToWishlist(userId, buildManualBookDto());
      await WishlistService.addToWishlist(
        userId,
        buildManualBookDto({ title: "Otro cuaderno" }),
      );

      expect(await WishlistItem.countDocuments({ userId })).toBe(2);
    });
  });

  describe("When the user already has the book in their library", () => {
    it("Then it should fail with BOOK_ALREADY_IN_LIBRARY and save nothing", async () => {
      const userId = newUserId();
      await BooksService.createBook(userId, buildCreateBookDto());

      await expect(
        WishlistService.addToWishlist(userId, buildAddToWishlistDto()),
      ).rejects.toMatchObject({
        code: "BOOK_ALREADY_IN_LIBRARY",
        httpStatus: 409,
      });
      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
    });
  });

  describe("When the book is already in the user's wishlist", () => {
    it("Then it should fail with BOOK_ALREADY_IN_WISHLIST", async () => {
      const userId = newUserId();
      await WishlistService.addToWishlist(userId, buildAddToWishlistDto());

      await expect(
        WishlistService.addToWishlist(userId, buildAddToWishlistDto()),
      ).rejects.toMatchObject({
        code: "BOOK_ALREADY_IN_WISHLIST",
        httpStatus: 409,
      });
      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
    });
  });

  describe("When another user has that book in their wishlist", () => {
    it("Then it should not conflict", async () => {
      await WishlistService.addToWishlist(newUserId(), buildAddToWishlistDto());

      await expect(
        WishlistService.addToWishlist(newUserId(), buildAddToWishlistDto()),
      ).resolves.toBeDefined();
    });
  });

  describe.each([
    ["an invalid ISBN", { isbn: "123" }, "INVALID_ISBN", "isbn"],
    ["no title", { title: "" }, "VALIDATION_ERROR", "title"],
    [
      "a note over 500 characters",
      { note: "a".repeat(501) },
      "VALIDATION_ERROR",
      "note",
    ],
    ["a note that is not text", { note: 3 }, "VALIDATION_ERROR", "note"],
  ])("When the body has %s", (_case, overrides, code, field) => {
    it(`Then it should fail with ${code} on ${field} and save nothing`, async () => {
      const userId = newUserId();

      await expect(
        WishlistService.addToWishlist(userId, {
          ...buildAddToWishlistDto(),
          ...overrides,
        }),
      ).rejects.toMatchObject({ code, field });
      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
      expect(await Book.countDocuments()).toBe(0);
    });
  });

  describe("When the body is not an object", () => {
    it("Then it should fail with VALIDATION_ERROR", async () => {
      await expect(
        WishlistService.addToWishlist(newUserId(), "libro"),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });
});
