import { Types } from "mongoose";
import { decodeLibraryCursor, encodeLibraryCursor } from "../libraryCursor.js";

const id = new Types.ObjectId().toString();

describe("Given the library cursor functions", () => {
  describe("When a cursor is encoded and decoded with the same sort", () => {
    it.each([
      ["recent", "2026-10-25T10:00:00.000Z"],
      ["oldest", "2026-10-25T10:00:00.000Z"],
      ["alpha", "Cien años de soledad"],
      ["alpha_desc", "Cien años de soledad"],
      ["book", "Cien años de soledad"],
      ["book_desc", "Cien años de soledad"],
    ])("Then it should return the same position for %s", (sort, value) => {
      const raw = encodeLibraryCursor({ sort, id, value });

      expect(decodeLibraryCursor(raw, sort)).toEqual({ sort, id, value });
    });
  });

  describe("When the cursor was created with another sort", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", () => {
      const raw = encodeLibraryCursor({
        sort: "recent",
        id,
        value: "2026-10-25T10:00:00.000Z",
      });

      expect(() => decodeLibraryCursor(raw, "oldest")).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR", field: "cursor" }),
      );
    });
  });

  describe("When a date sort has a value that is not a date", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", () => {
      const raw = encodeLibraryCursor({ sort: "recent", id, value: "ayer" });

      expect(() => decodeLibraryCursor(raw, "recent")).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    });
  });

  describe("When a text sort has a title that is not a date", () => {
    it("Then it should accept it", () => {
      const raw = encodeLibraryCursor({ sort: "book", id, value: "Ayer" });

      expect(decodeLibraryCursor(raw, "book").value).toBe("Ayer");
    });
  });

  describe("When the cursor is garbage or has an invalid id", () => {
    it("Then it should throw VALIDATION_ERROR on cursor", () => {
      const badId = encodeLibraryCursor({
        sort: "recent",
        id: "no-es-un-id",
        value: "2026-10-25T10:00:00.000Z",
      });

      expect(() => decodeLibraryCursor("basura", "recent")).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
      expect(() => decodeLibraryCursor(badId, "recent")).toThrow(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    });
  });
});
