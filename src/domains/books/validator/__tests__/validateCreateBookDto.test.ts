import ValidationError from "../../../../shared/errors/ValidationError.js";
import validateCreateBookDto from "../validateCreateBookDto.js";
import { FIELD_LIMITS } from "../fieldLimits.js";

const validBook = {
  title: "Cien años de soledad",
  authors: ["Gabriel García Márquez"],
  publisher: "Debolsillo",
};

const expectRejection = (body: unknown, field: string) => {
  try {
    validateCreateBookDto(body);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe(field);
    return;
  }

  throw new Error(`Se esperaba un rechazo en «${field}»`);
};

describe("Given the validation of a book to add", () => {
  describe("When the cover comes from the provider it declares", () => {
    it.each([
      ["google_books", "https://books.google.com/books/content?id=abc&zoom=1"],
      ["open_library", "https://covers.openlibrary.org/b/id/8231856-M.jpg"],
    ])("Then a %s cover is accepted", (coverSource, coverUrl) => {
      const dto = validateCreateBookDto({
        ...validBook,
        coverSource,
        coverUrl,
      });

      expect(dto.coverUrl).toBe(coverUrl);
    });

    it("Then an http Google cover is stored as https", () => {
      const dto = validateCreateBookDto({
        ...validBook,
        coverSource: "google_books",
        coverUrl: "http://books.google.com/books/content?id=abc&zoom=1",
      });

      expect(dto.coverUrl).toBe(
        "https://books.google.com/books/content?id=abc&zoom=1",
      );
    });
  });

  describe("When the cover points to a server that is not the provider it declares", () => {
    it.each([
      ["google_books", "https://evil.example/cover.jpg"],
      ["google_books", "https://covers.openlibrary.org/b/id/1-M.jpg"],
      ["open_library", "https://books.google.com/books/content?id=abc"],
      ["open_library", "https://books.google.com.evil.example/x.jpg"],
    ])(
      "Then %s with %s is rejected, so it cannot reach the shared catalog",
      (coverSource, coverUrl) => {
        expectRejection({ ...validBook, coverSource, coverUrl }, "coverUrl");
      },
    );
  });

  describe("When a text is longer than its limit", () => {
    it.each([
      ["title", { title: "T".repeat(FIELD_LIMITS.title + 1) }],
      ["publisher", { publisher: "E".repeat(FIELD_LIMITS.publisher + 1) }],
      ["synopsis", { synopsis: "S".repeat(FIELD_LIMITS.synopsis + 1) }],
      ["language", { language: "l".repeat(FIELD_LIMITS.language + 1) }],
    ])("Then %s is rejected", (field, extra) => {
      expectRejection({ ...validBook, ...extra }, field);
    });

    it("Then too many authors, or a very long author, are rejected", () => {
      expectRejection(
        { ...validBook, authors: Array(FIELD_LIMITS.authors + 1).fill("A") },
        "authors",
      );
      expectRejection(
        { ...validBook, authors: ["A".repeat(FIELD_LIMITS.author + 1)] },
        "authors.0",
      );
    });

    it("Then too many categories are rejected", () => {
      expectRejection(
        {
          ...validBook,
          categories: Array(FIELD_LIMITS.categories + 1).fill("Novela"),
        },
        "categories",
      );
    });
  });

  describe("When a text is exactly at its limit", () => {
    it("Then it is accepted", () => {
      const dto = validateCreateBookDto({
        ...validBook,
        title: "T".repeat(FIELD_LIMITS.title),
        synopsis: "S".repeat(FIELD_LIMITS.synopsis),
      });

      expect(dto.title).toHaveLength(FIELD_LIMITS.title);
    });
  });
});
