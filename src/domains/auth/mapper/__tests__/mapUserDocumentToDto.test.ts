import User from "../../model/User.js";
import mapUserDocumentToDto from "../mapUserDocumentToDto.js";

const buildUser = (
  preferences?: { libraryView?: "grid" | "list" },
  onboardingCompletedAt?: Date,
  avatarUpdatedAt?: Date,
) =>
  new User({
    name: "Isa",
    email: "isa@example.com",
    passwordHash: "hash-secreto",
    acceptedTermsAt: new Date(),
    refreshTokenHash: "token-secreto",
    ...(preferences && { preferences }),
    ...(onboardingCompletedAt && { onboardingCompletedAt }),
    ...(avatarUpdatedAt && {
      avatar: { contentType: "image/jpeg", updatedAt: avatarUpdatedAt },
    }),
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

  describe("When the user has no photo", () => {
    it("Then avatarUrl should be null", () => {
      expect(mapUserDocumentToDto(buildUser()).avatarUrl).toBeNull();
    });
  });

  describe("When the user has a photo", () => {
    it("Then avatarUrl should point to the avatar endpoint with the update time as cache-buster", () => {
      const updatedAt = new Date("2026-10-26T10:00:00.000Z");

      expect(
        mapUserDocumentToDto(buildUser(undefined, undefined, updatedAt))
          .avatarUrl,
      ).toBe(`/api/auth/me/avatar?v=${updatedAt.getTime()}`);
    });
  });

  describe("When the email is not verified yet", () => {
    it("Then emailVerified should be false", () => {
      expect(mapUserDocumentToDto(buildUser()).emailVerified).toBe(false);
    });
  });

  describe("When the user has sensitive fields", () => {
    it("Then the DTO should only expose the public fields", () => {
      expect(Object.keys(mapUserDocumentToDto(buildUser())).sort()).toEqual([
        "avatarUrl",
        "email",
        "emailVerified",
        "id",
        "name",
        "onboardingCompleted",
        "preferences",
      ]);
    });
  });
});
