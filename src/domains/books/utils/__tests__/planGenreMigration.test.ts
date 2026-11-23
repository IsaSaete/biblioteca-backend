import planGenreMigration from "../planGenreMigration.js";

const book = (id: string, categories: string[]) => ({
  id,
  title: `Libro ${id}`,
  categories,
});

describe("Given the genres already stored in some books", () => {
  describe("When a book has raw categories from a provider", () => {
    it("Then it plans a single genre of the catalog", () => {
      const { changes } = planGenreMigration([
        book("1", ["Fiction", "Fiction / Fantasy / General"]),
      ]);

      expect(changes).toEqual([
        {
          id: "1",
          title: "Libro 1",
          before: ["Fiction", "Fiction / Fantasy / General"],
          after: ["Fantasía"],
          unmapped: [],
        },
      ]);
    });
  });

  describe("When a book already has just its catalog genre", () => {
    it("Then it is left unchanged", () => {
      const plan = planGenreMigration([book("1", ["Historia"])]);

      expect(plan).toEqual({ changes: [], unchangedCount: 1 });
    });
  });

  describe("When no category of a book is a genre", () => {
    it("Then it plans to leave it without genre and reports what is discarded", () => {
      const { changes } = planGenreMigration([
        book("1", ["New York Times bestseller", "Large type books"]),
      ]);

      expect(changes[0]).toMatchObject({
        after: [],
        unmapped: ["New York Times bestseller", "Large type books"],
      });
    });
  });

  describe("When some categories are genres and some are noise", () => {
    it("Then it keeps the genre and reports the noise", () => {
      const { changes } = planGenreMigration([
        book("1", ["Spain", "Philosophy"]),
      ]);

      expect(changes[0]).toMatchObject({
        after: ["Filosofía"],
        unmapped: ["Spain"],
      });
    });
  });

  describe("When there are no books", () => {
    it("Then there is nothing to change", () => {
      expect(planGenreMigration([])).toEqual({
        changes: [],
        unchangedCount: 0,
      });
    });
  });
});
