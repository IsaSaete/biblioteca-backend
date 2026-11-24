import normalizeSynopsis from "../normalizeSynopsis.js";

describe("Given the normalizeSynopsis function", () => {
  describe("When the first words are in capitals", () => {
    it("Then it should lowercase them and capitalize the first letter", () => {
      const synopsis = "LA NOVELA QUE TODOS ESPERABAN cuenta una historia.";

      const result = normalizeSynopsis(synopsis);

      expect(result).toBe("La novela que todos esperaban cuenta una historia.");
    });
  });

  describe("When the whole synopsis is in capitals", () => {
    it("Then it should use sentence case, capitalizing each sentence", () => {
      const synopsis = "UNA HISTORIA BREVE. OTRA MÁS LARGA!";

      const result = normalizeSynopsis(synopsis);

      expect(result).toBe("Una historia breve. Otra más larga!");
    });
  });

  describe("When it is already well written", () => {
    it("Then it should leave it as it is", () => {
      const synopsis = "Una historia que habla de la ONU y del FMI.";

      const result = normalizeSynopsis(synopsis);

      expect(result).toBe(synopsis);
    });
  });

  describe("When it starts with a single acronym", () => {
    it("Then it should not touch it", () => {
      const synopsis = "ONU: un recorrido por su historia.";

      const result = normalizeSynopsis(synopsis);

      expect(result).toBe(synopsis);
    });
  });

  describe("When it has extra spaces around", () => {
    it("Then it should trim them", () => {
      const result = normalizeSynopsis("  Una historia.  ");

      expect(result).toBe("Una historia.");
    });
  });
});
