import { Types } from "mongoose";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import Book from "../../model/Book.js";
import Ejemplar from "../../model/Ejemplar.js";
import BooksService, { LIBRARY_PAGE_SIZE } from "../BooksService.js";
import { buildManualBookDto } from "../../fixtures/books.fixtures.js";

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

const addManualBooks = async (
  userId: string,
  titles: string[],
): Promise<void> => {
  for (const title of titles) {
    await BooksService.createBook(userId, buildManualBookDto({ title }));
  }
};

describe("Given the BooksService.listLibrary function", () => {
  describe("When the user has no books", () => {
    it("Then it should return an empty page without next cursor", async () => {
      const page = await BooksService.listLibrary(newUserId(), {});

      expect(page).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When two users have different books", () => {
    it("Then each user should only see their own", async () => {
      const userA = newUserId();
      const userB = newUserId();
      await addManualBooks(userA, ["Libro de A"]);
      await addManualBooks(userB, ["Libro de B"]);

      const page = await BooksService.listLibrary(userA, {});

      expect(page.items.map((item) => item.book.title)).toEqual(["Libro de A"]);
    });
  });

  describe("When the sort is recent (default)", () => {
    it("Then it should list the most recently added book first", async () => {
      const userId = newUserId();
      await addManualBooks(userId, ["Primero", "Segundo", "Tercero"]);

      const page = await BooksService.listLibrary(userId, {});

      expect(page.items.map((item) => item.book.title)).toEqual([
        "Tercero",
        "Segundo",
        "Primero",
      ]);
    });
  });

  describe("When the sort is alpha", () => {
    it("Then it should order by Book title ignoring case and accents", async () => {
      const userId = newUserId();
      await addManualBooks(userId, ["zeta", "Álbum", "beta", "Alfa"]);

      const page = await BooksService.listLibrary(userId, { sort: "alpha" });

      expect(page.items.map((item) => item.book.title)).toEqual([
        "Álbum",
        "Alfa",
        "beta",
        "zeta",
      ]);
    });
  });

  describe("When the user has more books than one page", () => {
    it.each(["recent", "alpha"] as const)(
      "Then following nextCursor with sort=%s should walk every book exactly once",
      async (sort) => {
        const userId = newUserId();
        const total = LIBRARY_PAGE_SIZE * 2 + 5;
        const titles = Array.from(
          { length: total },
          (_, index) => `Libro ${String(index).padStart(3, "0")}`,
        );
        await addManualBooks(userId, titles);

        const firstPage = await BooksService.listLibrary(userId, { sort });
        const secondPage = await BooksService.listLibrary(userId, {
          sort,
          cursor: firstPage.nextCursor ?? undefined,
        });
        const thirdPage = await BooksService.listLibrary(userId, {
          sort,
          cursor: secondPage.nextCursor ?? undefined,
        });

        expect(firstPage.items).toHaveLength(LIBRARY_PAGE_SIZE);
        expect(secondPage.items).toHaveLength(LIBRARY_PAGE_SIZE);
        expect(thirdPage.items).toHaveLength(5);
        expect(thirdPage.nextCursor).toBeNull();
        const seen = [firstPage, secondPage, thirdPage].flatMap((page) =>
          page.items.map((item) => item.book.title),
        );
        expect(new Set(seen).size).toBe(total);
      },
    );
  });

  describe("When the library has exactly one full page", () => {
    it("Then nextCursor should be null", async () => {
      const userId = newUserId();
      await addManualBooks(
        userId,
        Array.from(
          { length: LIBRARY_PAGE_SIZE },
          (_, index) => `Libro ${index}`,
        ),
      );

      const page = await BooksService.listLibrary(userId, {});

      expect(page.items).toHaveLength(LIBRARY_PAGE_SIZE);
      expect(page.nextCursor).toBeNull();
    });
  });

  describe("When the cursor is corrupt or was issued for another sort", () => {
    it("Then it should fail with VALIDATION_ERROR on cursor", async () => {
      const userId = newUserId();
      await addManualBooks(
        userId,
        Array.from({ length: LIBRARY_PAGE_SIZE + 1 }, (_, i) => `Libro ${i}`),
      );
      const { nextCursor } = await BooksService.listLibrary(userId, {});

      const corrupt = BooksService.listLibrary(userId, { cursor: "no-es" });
      const otherSort = BooksService.listLibrary(userId, {
        sort: "alpha",
        cursor: nextCursor ?? undefined,
      });

      await expect(corrupt).rejects.toMatchObject({ field: "cursor" });
      await expect(otherSort).rejects.toMatchObject({ field: "cursor" });
    });
  });

  describe("When the sort value is unknown", () => {
    it("Then it should fail with VALIDATION_ERROR on sort", async () => {
      const result = BooksService.listLibrary(newUserId(), { sort: "random" });

      await expect(result).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "sort",
      });
    });
  });
});
