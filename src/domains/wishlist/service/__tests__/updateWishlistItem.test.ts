import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
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

const addManual = (userId: string, note?: string) =>
  WishlistService.addToWishlist(userId, {
    ...buildManualBookDto(),
    ...(note && { note }),
  });

describe("Given the WishlistService.updateWishlistItem function", () => {
  describe("When the user sets a note", () => {
    it("Then it should return the item with the trimmed note and store it", async () => {
      const userId = newUserId();
      const item = await addManual(userId);

      const updated = await WishlistService.updateWishlistItem(
        userId,
        item.id,
        {
          note: "  Edición de bolsillo  ",
        },
      );

      expect(updated).toEqual({ ...item, note: "Edición de bolsillo" });
      expect((await WishlistItem.findById(item.id))?.note).toBe(
        "Edición de bolsillo",
      );
    });
  });

  describe("When the user replaces an existing note", () => {
    it("Then it should keep only the new one", async () => {
      const userId = newUserId();
      const item = await addManual(userId, "Antigua");

      const updated = await WishlistService.updateWishlistItem(
        userId,
        item.id,
        {
          note: "Nueva",
        },
      );

      expect(updated.note).toBe("Nueva");
    });
  });

  describe.each([
    ["null", null],
    ["an empty string", ""],
    ["only spaces", "   "],
  ])("When the note is %s", (_case, note) => {
    it("Then it should remove the note", async () => {
      const userId = newUserId();
      const item = await addManual(userId, "Antigua");

      const updated = await WishlistService.updateWishlistItem(
        userId,
        item.id,
        {
          note,
        },
      );

      expect(updated).not.toHaveProperty("note");
      expect((await WishlistItem.findById(item.id))?.note).toBeUndefined();
    });
  });

  describe("When the body is empty", () => {
    it("Then it should return the item unchanged", async () => {
      const userId = newUserId();
      const item = await addManual(userId, "Se queda");

      const updated = await WishlistService.updateWishlistItem(
        userId,
        item.id,
        {},
      );

      expect(updated).toEqual(item);
    });
  });

  describe("When the body also carries fields that cannot be edited", () => {
    it("Then it should ignore them and not touch the Libro", async () => {
      const userId = newUserId();
      const item = await addManual(userId);

      const updated = await WishlistService.updateWishlistItem(
        userId,
        item.id,
        {
          note: "Nota",
          title: "Otro título",
          userId: newUserId(),
        },
      );

      expect(updated.book.title).toBe(item.book.title);
      expect((await WishlistItem.findById(item.id))?.userId.toString()).toBe(
        userId,
      );
    });
  });

  describe.each([
    ["longer than 500 characters", "a".repeat(501)],
    ["not a string", 3],
  ])("When the note is %s", (_case, note) => {
    it("Then it should fail with VALIDATION_ERROR on note and keep the stored one", async () => {
      const userId = newUserId();
      const item = await addManual(userId, "Se queda");

      await expect(
        WishlistService.updateWishlistItem(userId, item.id, { note }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "note" });
      expect((await WishlistItem.findById(item.id))?.note).toBe("Se queda");
    });
  });

  describe("When the item belongs to another user", () => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND and change nothing", async () => {
      const item = await addManual(newUserId(), "Ajena");

      await expect(
        WishlistService.updateWishlistItem(newUserId(), item.id, {
          note: "Intrusa",
        }),
      ).rejects.toMatchObject({
        code: "WISHLIST_ITEM_NOT_FOUND",
        httpStatus: 404,
      });
      expect((await WishlistItem.findById(item.id))?.note).toBe("Ajena");
    });
  });

  describe.each([
    ["does not exist", () => new Types.ObjectId().toString()],
    ["is not a valid id", () => "no-es-un-id"],
  ])("When the id %s", (_case, buildId) => {
    it("Then it should fail with WISHLIST_ITEM_NOT_FOUND", async () => {
      await expect(
        WishlistService.updateWishlistItem(newUserId(), buildId(), {
          note: "x",
        }),
      ).rejects.toMatchObject({ code: "WISHLIST_ITEM_NOT_FOUND" });
    });
  });
});
