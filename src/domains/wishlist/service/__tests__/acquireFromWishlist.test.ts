import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import { buildAddToWishlistDto } from "../../fixtures/wishlist.fixtures.js";
import BooksService from "../../../books/service/BooksService.js";
import WishlistItem from "../../model/WishlistItem.js";
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

const addToWishlist = (userId: string) =>
  WishlistService.addToWishlist(userId, buildAddToWishlistDto());

describe("Given the WishlistService.acquireFromWishlist function", () => {
  describe("When the user already has the item in their wishlist", () => {
    it("Then it should create the Ejemplar as pending, remove the item and return { book, ejemplar }", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);

      const result = await WishlistService.acquireFromWishlist(
        userId,
        item.id,
        undefined,
      );

      expect(result.book).toEqual(item.book);
      expect(result.ejemplar).toMatchObject({
        id: expect.any(String),
        bookId: item.book.id,
        status: "pending",
        favorite: false,
      });
      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
      expect(await Ejemplar.countDocuments({ userId })).toBe(1);
    });

    it("Then the book should show up in the library", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);

      await WishlistService.acquireFromWishlist(userId, item.id, {});

      const owned = await BooksService.getBook(userId, item.book.id);
      expect(owned.book.id).toBe(item.book.id);
    });

    it("Then it should use the reading status that is sent", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);

      const result = await WishlistService.acquireFromWishlist(
        userId,
        item.id,
        {
          status: "reading",
        },
      );

      expect(result.ejemplar.status).toBe("reading");
    });

    it("Then it should not modify the Libro", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);
      const before = await Book.findById(item.book.id).lean();

      await WishlistService.acquireFromWishlist(userId, item.id, {});

      expect(await Book.findById(item.book.id).lean()).toEqual(before);
    });
  });

  describe("When the user already had that book in their library", () => {
    it("Then it should remove the item without error and return the Ejemplar they already had", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);
      // Ya no se llega aquí por POST /books (que retira el deseado): queda el
      // caso de una carrera entre las dos altas o de datos anteriores.
      const owned = await Ejemplar.create({
        userId,
        bookId: new Types.ObjectId(item.book.id),
        status: "read",
      });

      const result = await WishlistService.acquireFromWishlist(
        userId,
        item.id,
        {
          status: "reading",
        },
      );

      expect(result.ejemplar.id).toBe(owned._id.toString());
      expect(result.ejemplar.status).toBe("read");
      expect(await Ejemplar.countDocuments({ userId })).toBe(1);
      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
    });
  });

  describe("When the status is not valid", () => {
    it.each([
      ["unknown", "perdido"],
      ["not a string", 3],
    ])(
      "Then a status that is %s should fail with VALIDATION_ERROR and change nothing",
      async (_case, status) => {
        const userId = newUserId();
        const item = await addToWishlist(userId);

        await expect(
          WishlistService.acquireFromWishlist(userId, item.id, { status }),
        ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "status" });
        expect(await WishlistItem.countDocuments({ userId })).toBe(1);
        expect(await Ejemplar.countDocuments({ userId })).toBe(0);
      },
    );
  });

  describe("When the item belongs to another user", () => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND and create nothing", async () => {
      const item = await addToWishlist(newUserId());
      const intruder = newUserId();

      await expect(
        WishlistService.acquireFromWishlist(intruder, item.id, {}),
      ).rejects.toMatchObject({
        code: "WISHLIST_ITEM_NOT_FOUND",
        httpStatus: 404,
      });
      expect(await Ejemplar.countDocuments()).toBe(0);
      expect(await WishlistItem.countDocuments()).toBe(1);
    });
  });

  describe.each([
    ["does not exist", () => new Types.ObjectId().toString()],
    ["is not a valid id", () => "no-es-un-id"],
  ])("When the id %s", (_case, buildId) => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND", async () => {
      await expect(
        WishlistService.acquireFromWishlist(newUserId(), buildId(), {}),
      ).rejects.toMatchObject({ code: "WISHLIST_ITEM_NOT_FOUND" });
    });
  });

  describe("When the item was already acquired", () => {
    it("Then a second attempt should fail with WISHLIST_ITEM_NOT_FOUND and not duplicate the Ejemplar", async () => {
      const userId = newUserId();
      const item = await addToWishlist(userId);
      await WishlistService.acquireFromWishlist(userId, item.id, {});

      await expect(
        WishlistService.acquireFromWishlist(userId, item.id, {}),
      ).rejects.toMatchObject({ code: "WISHLIST_ITEM_NOT_FOUND" });
      expect(await Ejemplar.countDocuments({ userId })).toBe(1);
    });
  });
});
