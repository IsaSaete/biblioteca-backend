import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import {
  buildManualBookDto,
  buildCreateBookDto,
  OTHER_EDITION_ISBN_13,
} from "../../../books/fixtures/books.fixtures.js";
import WishlistItem from "../../model/WishlistItem.js";
import WishlistService, { WISHLIST_PAGE_SIZE } from "../WishlistService.js";

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

const addManual = (userId: string, title: string, note?: string) =>
  WishlistService.addToWishlist(userId, {
    ...buildManualBookDto({ title }),
    ...(note && { note }),
  });

describe("Given the WishlistService.listWishlist function", () => {
  describe("When the user has no wishlist", () => {
    it("Then it should return an empty page", async () => {
      const page = await WishlistService.listWishlist(newUserId(), {});

      expect(page).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When the user has saved several books", () => {
    it("Then it should list them newest first, with the note and the total", async () => {
      const userId = newUserId();
      const first = await addManual(userId, "Primero");
      const second = await addManual(userId, "Segundo", "Una nota");

      const page = await WishlistService.listWishlist(userId, {});

      expect(page.items).toEqual([second, first]);
      expect(page.items[0].note).toBe("Una nota");
      expect(page.nextCursor).toBeNull();
      expect(page.total).toBe(2);
    });
  });

  describe("When another user also has a wishlist", () => {
    it("Then it should list and count only the user's own", async () => {
      const userId = newUserId();
      await addManual(userId, "Mío");
      await addManual(newUserId(), "Ajeno");

      const page = await WishlistService.listWishlist(userId, {});

      expect(page.items.map((item) => item.book.title)).toEqual(["Mío"]);
      expect(page.total).toBe(1);
    });
  });

  describe("When there are more items than fit in a page", () => {
    it("Then it should page with the cursor, without repeating or losing any", async () => {
      const userId = newUserId();
      const added = [];
      for (let i = 0; i < WISHLIST_PAGE_SIZE + 1; i += 1) {
        added.push(await addManual(userId, `Libro ${i}`));
      }

      const first = await WishlistService.listWishlist(userId, {});
      const second = await WishlistService.listWishlist(userId, {
        cursor: first.nextCursor ?? "",
      });

      expect(first.items).toHaveLength(WISHLIST_PAGE_SIZE);
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(first.total).toBe(WISHLIST_PAGE_SIZE + 1);
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items]).toEqual([...added].reverse());
    });
  });

  describe("When the book is also in the catalog because another user owns it", () => {
    it("Then it should list it like any other", async () => {
      const userId = newUserId();
      await WishlistService.addToWishlist(userId, {
        ...buildCreateBookDto({ isbn: OTHER_EDITION_ISBN_13 }),
      });

      const page = await WishlistService.listWishlist(userId, {});

      expect(page.items).toHaveLength(1);
    });
  });

  describe.each([
    ["not base64 JSON", "no-es-un-cursor"],
    [
      "from another list order",
      Buffer.from(
        JSON.stringify({
          sort: "alpha",
          id: "507f1f77bcf86cd799439011",
          value: "Algo",
        }),
      ).toString("base64url"),
    ],
    [
      "with an id that is not valid",
      Buffer.from(
        JSON.stringify({
          sort: "recent",
          id: "x",
          value: "2026-01-01T00:00:00.000Z",
        }),
      ).toString("base64url"),
    ],
  ])("When the cursor is %s", (_case, cursor) => {
    it("Then it should fail with VALIDATION_ERROR on cursor", async () => {
      await expect(
        WishlistService.listWishlist(newUserId(), { cursor }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "cursor" });
    });
  });
});
