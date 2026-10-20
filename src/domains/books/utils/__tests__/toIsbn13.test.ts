import toIsbn13 from "../toIsbn13.js";
import { ISBN_10_OF_ISBN_13, ISBN_13 } from "../../fixtures/books.fixtures.js";

describe("Given the toIsbn13 function", () => {
  describe("When it receives a valid ISBN-13 with hyphens and spaces", () => {
    it("Then it should return it normalized without separators", () => {
      const rawIsbn = "978-0 306-40615-7";

      const isbn = toIsbn13(rawIsbn);

      expect(isbn).toBe(ISBN_13);
    });
  });

  describe("When it receives a valid ISBN-10", () => {
    it("Then it should convert it to the equivalent ISBN-13", () => {
      const isbn = toIsbn13(ISBN_10_OF_ISBN_13);

      expect(isbn).toBe(ISBN_13);
    });
  });

  describe("When it receives an ISBN-10 ending in X", () => {
    it("Then it should accept it, even in lowercase", () => {
      const isbn = toIsbn13("0-8044-2957-x");

      expect(isbn).toBe("9780804429573");
    });
  });

  describe("When the check digit is wrong", () => {
    it.each(["9780306406158", "0306406153"])(
      "Then it should return null for %s",
      (rawIsbn) => {
        const isbn = toIsbn13(rawIsbn);

        expect(isbn).toBeNull();
      },
    );
  });

  describe("When the format is not an ISBN", () => {
    it.each(["", "abc", "12345", "9770306406155", "03064061520"])(
      "Then it should return null for '%s'",
      (rawIsbn) => {
        const isbn = toIsbn13(rawIsbn);

        expect(isbn).toBeNull();
      },
    );
  });
});
