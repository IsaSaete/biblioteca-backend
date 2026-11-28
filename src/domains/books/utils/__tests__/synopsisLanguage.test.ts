import synopsisLanguageMatch from "../synopsisLanguage.js";

const SPANISH =
  "Esta es la historia de un médico que llegó a un pequeño destacamento del desierto y que, durante años, cuidó de los soldados y de las gentes de la región.";
const ENGLISH =
  "This is the story of a doctor who arrived at a small outpost in the desert and who, for years, took care of the soldiers and of the people of the region.";

describe("Given the synopsisLanguageMatch function", () => {
  describe("When the synopsis is in the language of the book", () => {
    it("Then it returns match", () => {
      expect(synopsisLanguageMatch(SPANISH, "es")).toBe("match");
    });
  });

  describe("When the synopsis is in another language", () => {
    it("Then it returns mismatch", () => {
      expect(synopsisLanguageMatch(ENGLISH, "es")).toBe("mismatch");
    });
  });

  describe("When the language of the book is missing or not supported", () => {
    it("Then it returns unknown", () => {
      expect(synopsisLanguageMatch(ENGLISH)).toBe("unknown");
      expect(synopsisLanguageMatch(ENGLISH, "xx")).toBe("unknown");
    });
  });

  describe("When the synopsis is too short to tell", () => {
    it("Then it returns unknown", () => {
      expect(synopsisLanguageMatch("A novel.", "es")).toBe("unknown");
    });
  });

  describe("When the language code comes with a region", () => {
    it("Then it uses only the language", () => {
      expect(synopsisLanguageMatch(SPANISH, "es-ES")).toBe("match");
    });
  });
});
