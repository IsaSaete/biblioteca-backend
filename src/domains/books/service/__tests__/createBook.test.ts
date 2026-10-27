import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import WishlistItem from "../../../wishlist/model/WishlistItem.js";
import WishlistService from "../../../wishlist/service/WishlistService.js";
import { buildAddToWishlistDto } from "../../../wishlist/fixtures/wishlist.fixtures.js";
import BooksService from "../BooksService.js";
import {
  ISBN_10_OF_ISBN_13,
  ISBN_13,
  OTHER_EDITION_ISBN_13,
  buildCreateBookDto,
  buildManualBookDto,
} from "../../fixtures/books.fixtures.js";

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

const newUserId = (): string => new Types.ObjectId().toString();

describe("Given the BooksService.createBook function", () => {
  describe("When a user adds a book whose ISBN nobody has added yet", () => {
    it("Then it should create the Book and the user's Ejemplar as pending", async () => {
      const userId = newUserId();
      const dto = buildCreateBookDto();

      const { book, ejemplar } = await BooksService.createBook(userId, dto);

      expect(book).toMatchObject({ isbn: ISBN_13, title: dto.title });
      expect(ejemplar).toMatchObject({ bookId: book.id, status: "pending" });
      expect(ejemplar.overrides).toBeUndefined();
      expect(await Book.countDocuments()).toBe(1);
      expect(await Ejemplar.countDocuments({ userId })).toBe(1);
    });
  });

  describe("When the user chooses a reading status", () => {
    it("Then the Ejemplar should be created with that status", async () => {
      const dto = buildCreateBookDto({ status: "reading" });

      const { ejemplar } = await BooksService.createBook(newUserId(), dto);

      expect(ejemplar.status).toBe("reading");
    });
  });

  describe("When the ISBN comes as an ISBN-10 with hyphens", () => {
    it("Then the Book should be stored with the ISBN-13", async () => {
      const dto = buildCreateBookDto({ isbn: "0-306-40615-2" });

      const { book } = await BooksService.createBook(newUserId(), dto);

      expect(ISBN_10_OF_ISBN_13).not.toBe(book.isbn);
      expect(book.isbn).toBe(ISBN_13);
    });
  });

  describe("When a second user adds a book whose ISBN already exists as a Book", () => {
    it("Then it should link a new Ejemplar to the existing Book without creating another", async () => {
      const first = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );

      const second = await BooksService.createBook(
        newUserId(),
        buildCreateBookDto(),
      );

      expect(second.book.id).toBe(first.book.id);
      expect(second.ejemplar.id).not.toBe(first.ejemplar.id);
      expect(await Book.countDocuments()).toBe(1);
      expect(await Ejemplar.countDocuments()).toBe(2);
    });
  });

  describe("When the second user corrects some data of the existing Book", () => {
    it("Then the correction should go to the Ejemplar overrides and the Book stay untouched", async () => {
      const original = buildCreateBookDto();
      await BooksService.createBook(newUserId(), original);
      const corrected = buildCreateBookDto({
        title: "La sombra del viento (edición de bolsillo)",
        publisher: original.publisher,
      });

      const { book, ejemplar } = await BooksService.createBook(
        newUserId(),
        corrected,
      );

      expect(ejemplar.overrides).toEqual({ title: corrected.title });
      expect(book.title).toBe(original.title);
      const storedBook = await Book.findOne({ isbn: ISBN_13 });
      expect(storedBook?.title).toBe(original.title);
    });
  });

  describe("When the user already has that Book in their library", () => {
    it("Then it should fail with BOOK_ALREADY_IN_LIBRARY", async () => {
      const userId = newUserId();
      await BooksService.createBook(userId, buildCreateBookDto());

      const result = BooksService.createBook(userId, buildCreateBookDto());

      await expect(result).rejects.toMatchObject({
        code: "BOOK_ALREADY_IN_LIBRARY",
        httpStatus: 409,
      });
      expect(await Ejemplar.countDocuments({ userId })).toBe(1);
    });
  });

  describe("When the user adds another edition with a different ISBN", () => {
    it("Then it should create a different Book without conflict", async () => {
      const userId = newUserId();
      const first = await BooksService.createBook(userId, buildCreateBookDto());

      const second = await BooksService.createBook(
        userId,
        buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13 }),
      );

      expect(second.book.id).not.toBe(first.book.id);
      expect(await Ejemplar.countDocuments({ userId })).toBe(2);
    });
  });

  describe("When the user adds the same manual book without ISBN twice", () => {
    it("Then it should not detect a duplicate and create two Books", async () => {
      const userId = newUserId();
      const dto = buildManualBookDto();

      await BooksService.createBook(userId, dto);
      await BooksService.createBook(userId, dto);

      expect(await Book.countDocuments()).toBe(2);
      expect(await Ejemplar.countDocuments({ userId })).toBe(2);
    });
  });

  describe("When the ISBN has a wrong check digit", () => {
    it("Then it should fail with INVALID_ISBN on the isbn field and save nothing", async () => {
      const dto = buildCreateBookDto({ isbn: "9780306406158" });

      const result = BooksService.createBook(newUserId(), dto);

      await expect(result).rejects.toMatchObject({
        code: "INVALID_ISBN",
        field: "isbn",
        httpStatus: 400,
      });
      expect(await Book.countDocuments()).toBe(0);
    });
  });

  describe("When mandatory data is missing", () => {
    it.each([
      ["title", { title: "  " }],
      ["authors", { authors: [] }],
      ["publisher", { publisher: undefined }],
    ])(
      "Then it should fail with VALIDATION_ERROR on %s",
      async (field, patch) => {
        const dto = buildCreateBookDto(patch);

        const result = BooksService.createBook(newUserId(), dto);

        await expect(result).rejects.toMatchObject({
          code: "VALIDATION_ERROR",
          field,
        });
      },
    );
  });

  describe("When a cover URL arrives without its provider", () => {
    it("Then it should fail with VALIDATION_ERROR on coverSource", async () => {
      const dto = buildCreateBookDto({ coverSource: undefined });

      const result = BooksService.createBook(newUserId(), dto);

      await expect(result).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "coverSource",
      });
    });
  });

  describe("When the book was in the user's wishlist", () => {
    it("Then it should remove the wishlist item and keep the Libro", async () => {
      const userId = newUserId();
      await WishlistService.addToWishlist(userId, buildAddToWishlistDto());

      await BooksService.createBook(userId, buildCreateBookDto());

      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
      expect(await Book.countDocuments()).toBe(1);
    });

    it("Then it should leave the other items of the wishlist alone", async () => {
      const userId = newUserId();
      await WishlistService.addToWishlist(userId, buildAddToWishlistDto());
      await WishlistService.addToWishlist(userId, buildManualBookDto());

      await BooksService.createBook(userId, buildCreateBookDto());

      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
    });
  });

  describe("When another user has that book in their wishlist", () => {
    it("Then it should not touch their item", async () => {
      const other = newUserId();
      await WishlistService.addToWishlist(other, buildAddToWishlistDto());

      await BooksService.createBook(newUserId(), buildCreateBookDto());

      expect(await WishlistItem.countDocuments({ userId: other })).toBe(1);
    });
  });

  describe("When the user already has the book and tries to add it again", () => {
    it("Then it should fail without touching their wishlist", async () => {
      const userId = newUserId();
      await BooksService.createBook(userId, buildCreateBookDto());
      await WishlistItem.create({
        userId,
        bookId: (await Book.findOne())?._id,
      });

      await expect(
        BooksService.createBook(userId, buildCreateBookDto()),
      ).rejects.toMatchObject({ code: "BOOK_ALREADY_IN_LIBRARY" });
      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
    });
  });
});
