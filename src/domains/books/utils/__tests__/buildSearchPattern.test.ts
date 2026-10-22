import buildSearchPattern from "../buildSearchPattern.js";

const matches = (term: string, text: string): boolean =>
  new RegExp(buildSearchPattern(term), "i").test(text);

describe("Given the buildSearchPattern function", () => {
  describe("When the term has no accents but the text does", () => {
    it("Then it should match ignoring accents and case", () => {
      expect(matches("garcia marquez", "Gabriel GARCÍA Márquez")).toBe(true);
      expect(matches("ninos", "Los niños")).toBe(true);
    });
  });

  describe("When the term has accents but the text does not", () => {
    it("Then it should still match", () => {
      expect(matches("García", "garcia")).toBe(true);
    });
  });

  describe("When the term contains regex special characters", () => {
    it("Then it should treat them as plain text", () => {
      expect(matches("c++ (2ª ed.)", "Manual de C++ (2ª ed.)")).toBe(true);
      expect(matches(".*", "Cualquier cosa")).toBe(false);
    });
  });

  describe("When the text does not contain the term", () => {
    it("Then it should not match", () => {
      expect(matches("borges", "Gabriel García Márquez")).toBe(false);
    });
  });
});
