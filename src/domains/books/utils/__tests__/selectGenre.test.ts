import { GENRES } from "../genres.js";
import selectGenre from "../selectGenre.js";

describe("Given a genre that is already in the catalog", () => {
  describe("When it is normalised again", () => {
    it.each(GENRES)("Then %s stays as it is", (genre) => {
      expect(selectGenre([genre]).genre).toBe(genre);
    });
  });
});

describe("Given the categories of a provider", () => {
  describe("When they are in English or in Spanish", () => {
    it.each([
      [["History"], "Historia"],
      [["Historia"], "Historia"],
      [["Science Fiction"], "Ciencia ficción"],
      [["Ciencia-ficción"], "Ciencia ficción"],
      [["Detective and mystery stories"], "Misterio y novela negra"],
      [["Novela de misterio"], "Misterio y novela negra"],
      [["Comics & Graphic Novels"], "Cómic y novela gráfica"],
    ])("Then %j becomes %s", (categories, expected) => {
      expect(selectGenre(categories).genre).toBe(expected);
    });
  });

  describe("When a category is a hierarchy", () => {
    it("Then it uses the most specific level and skips General", () => {
      expect(selectGenre(["Fiction / Fantasy / General"]).genre).toBe(
        "Fantasía",
      );
    });
  });

  describe("When a category has a nationality or a nuance", () => {
    it.each([
      ["Chilean poetry", "Poesía"],
      ["Latin American poetry", "Poesía"],
      ["Clinical psychology", "Psicología"],
      ["Spanish American essays", "Ensayo"],
      ["Historical fiction, Chilean", "Novela histórica"],
      ["Detective and mystery stories, Spanish", "Misterio y novela negra"],
      ["Cooking, Mediterranean", "Cocina"],
    ])("Then %s becomes %s", (category, expected) => {
      expect(selectGenre([category]).genre).toBe(expected);
    });
  });

  describe("When there are generic and specific genres", () => {
    it("Then it keeps the specific one and drops the generic Ficción", () => {
      const { genre } = selectGenre(["Fiction", "Fiction / Fantasy / General"]);

      expect(genre).toBe("Fantasía");
    });

    it("Then it keeps Ficción when it is the only one", () => {
      expect(selectGenre(["Fiction", "Spanish fiction"]).genre).toBe("Ficción");
    });
  });

  describe("When the categories are about a disease and its patients", () => {
    it("Then it is Medicina y salud, the first genre the provider gave", () => {
      const { genre, unmapped } = selectGenre([
        "Patients",
        "Cáncer",
        "Cancer",
        "Psychological aspects",
        "Aspectos psicológicos",
      ]);

      expect(genre).toBe("Medicina y salud");
      expect(unmapped).toEqual([]);
    });
  });

  describe("When there are several specific genres", () => {
    it("Then it keeps the first one the provider gave", () => {
      expect(selectGenre(["Philosophy", "History"]).genre).toBe("Filosofía");
    });
  });

  describe("When a category is not a genre", () => {
    it("Then it is discarded and reported as unmapped", () => {
      const result = selectGenre([
        "New York Times bestseller",
        "Spain",
        "Authors, Bolivian",
        "Fantasy",
      ]);

      expect(result.genre).toBe("Fantasía");
      expect(result.unmapped).toEqual([
        "New York Times bestseller",
        "Spain",
        "Authors, Bolivian",
      ]);
    });

    it("Then there is no genre when nothing is recognised", () => {
      expect(selectGenre(["Desire", "Large type books"])).toEqual({
        genre: undefined,
        unmapped: ["Desire", "Large type books"],
      });
    });
  });

  describe("When there are no categories", () => {
    it("Then there is no genre", () => {
      expect(selectGenre([])).toEqual({ genre: undefined, unmapped: [] });
    });
  });
});
