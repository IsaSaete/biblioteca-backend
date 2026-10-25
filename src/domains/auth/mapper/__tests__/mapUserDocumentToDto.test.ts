import User from "../../model/User.js";
import mapUserDocumentToDto from "../mapUserDocumentToDto.js";

const buildUser = (
  preferences?: { libraryView?: "grid" | "list" },
  onboardingCompletedAt?: Date,
) =>
  new User({
    name: "Isa",
    email: "isa@example.com",
    passwordHash: "hash-secreto",
    acceptedTermsAt: new Date(),
    refreshTokenHash: "token-secreto",
    ...(preferences && { preferences }),
    ...(onboardingCompletedAt && { onboardingCompletedAt }),
  });

describe("Given the mapUserDocumentToDto function", () => {
  describe("When the user never chose a library view", () => {
    it("Then preferences.libraryView should be grid", () => {
      expect(mapUserDocumentToDto(buildUser()).preferences).toEqual({
        libraryView: "grid",
      });
    });
  });

  describe("When the user chose the list view", () => {
    it("Then preferences.libraryView should be list", () => {
      expect(
        mapUserDocumentToDto(buildUser({ libraryView: "list" })).preferences,
      ).toEqual({ libraryView: "list" });
    });
  });

  describe("When the user has not seen the onboarding", () => {
    it("Then onboardingCompleted should be false", () => {
      expect(mapUserDocumentToDto(buildUser()).onboardingCompleted).toBe(false);
    });
  });

  describe("When the user completed or skipped the onboarding", () => {
    it("Then onboardingCompleted should be true and the date should not be exposed", () => {
      const dto = mapUserDocumentToDto(buildUser(undefined, new Date()));

      expect(dto.onboardingCompleted).toBe(true);
      expect(dto).not.toHaveProperty("onboardingCompletedAt");
    });
  });

  describe("When the user has sensitive fields", () => {
    it("Then the DTO should only expose id, name, email and preferences", () => {
      expect(Object.keys(mapUserDocumentToDto(buildUser())).sort()).toEqual([
        "email",
        "id",
        "name",
        "onboardingCompleted",
        "preferences",
      ]);
    });
  });
});
