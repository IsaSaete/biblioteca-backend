import ValidationError from "../../../../shared/errors/ValidationError.js";
import { FIELD_LIMITS } from "../fieldLimits.js";
import validateUpdateEjemplarDto from "../validateUpdateEjemplarDto.js";

const expectRejection = (body: unknown, field: string) => {
  try {
    validateUpdateEjemplarDto(body);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe(field);
    return;
  }

  throw new Error(`Se esperaba un rechazo en «${field}»`);
};

describe("Given the validation of the changes to a copy of a book", () => {
  describe("When a free text is longer than its limit", () => {
    it.each([
      ["notes", { notes: "n".repeat(FIELD_LIMITS.notes + 1) }],
      ["location", { location: "u".repeat(FIELD_LIMITS.location + 1) }],
      ["tags.0", { tags: ["t".repeat(FIELD_LIMITS.tag + 1)] }],
      [
        "overrides.title",
        { overrides: { title: "T".repeat(FIELD_LIMITS.title + 1) } },
      ],
      [
        "overrides.synopsis",
        { overrides: { synopsis: "S".repeat(FIELD_LIMITS.synopsis + 1) } },
      ],
    ])("Then %s is rejected", (field, body) => {
      expectRejection(body, field);
    });
  });

  describe("When the texts fit and one is cleared", () => {
    it("Then they are accepted and an empty text clears the field", () => {
      const dto = validateUpdateEjemplarDto({
        notes: "n".repeat(FIELD_LIMITS.notes),
        location: "",
      });

      expect(dto.notes).toHaveLength(FIELD_LIMITS.notes);
      expect(dto.location).toBeNull();
    });
  });
});
