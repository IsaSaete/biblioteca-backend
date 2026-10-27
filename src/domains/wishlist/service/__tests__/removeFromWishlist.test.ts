import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import { buildAddToWishlistDto } from "../../fixtures/wishlist.fixtures.js";
import { buildManualBookDto } from "../../../books/fixtures/books.fixtures.js";
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

const addManual = (userId: string) =>
  WishlistService.addToWishlist(userId, buildManualBookDto());

describe("Given the WishlistService.removeFromWishlist function", () => {
  describe("When the user removes one of their items", () => {
    it("Then it should delete the item and keep the shared Libro", async () => {
      const userId = newUserId();
      const item = await addManual(userId);

      await WishlistService.removeFromWishlist(userId, item.id);

      expect(await WishlistItem.countDocuments({ userId })).toBe(0);
      expect(await Book.countDocuments()).toBe(1);
    });

    it("Then it should leave their other items alone", async () => {
      const userId = newUserId();
      const item = await addManual(userId);
      await WishlistService.addToWishlist(
        userId,
        buildManualBookDto({ title: "Otro" }),
      );

      await WishlistService.removeFromWishlist(userId, item.id);

      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
    });

    it("Then the user should be able to save the same book again", async () => {
      const userId = newUserId();
      const item = await WishlistService.addToWishlist(
        userId,
        buildAddToWishlistDto(),
      );
      await WishlistService.removeFromWishlist(userId, item.id);

      await expect(
        WishlistService.addToWishlist(userId, buildAddToWishlistDto()),
      ).resolves.toMatchObject({ book: { id: item.book.id } });
    });
  });

  describe("When the item belongs to another user", () => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND and keep it", async () => {
      const item = await addManual(newUserId());

      await expect(
        WishlistService.removeFromWishlist(newUserId(), item.id),
      ).rejects.toMatchObject({
        code: "WISHLIST_ITEM_NOT_FOUND",
        httpStatus: 404,
      });
      expect(await WishlistItem.countDocuments()).toBe(1);
    });
  });

  describe("When the item was already removed", () => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND", async () => {
      const userId = newUserId();
      const item = await addManual(userId);
      await WishlistService.removeFromWishlist(userId, item.id);

      await expect(
        WishlistService.removeFromWishlist(userId, item.id),
      ).rejects.toMatchObject({ code: "WISHLIST_ITEM_NOT_FOUND" });
    });
  });

  describe("When the id is not valid", () => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND", async () => {
      await expect(
        WishlistService.removeFromWishlist(newUserId(), "no-es-un-id"),
      ).rejects.toMatchObject({ code: "WISHLIST_ITEM_NOT_FOUND" });
    });
  });
});
