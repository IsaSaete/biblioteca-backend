import User from "../../model/User.js";
import mapUserDocumentToDto from "../mapUserDocumentToDto.js";

const buildUser = (preferences?: { libraryView?: "grid" | "list" }) =>
  new User({
    name: "Isa",
    email: "isa@example.com",
    passwordHash: "hash-secreto",
    acceptedTermsAt: new Date(),
    refreshTokenHash: "token-secreto",
    ...(preferences && { preferences }),
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

  describe("When the user has sensitive fields", () => {
    it("Then the DTO should only expose id, name, email and preferences", () => {
      expect(Object.keys(mapUserDocumentToDto(buildUser())).sort()).toEqual([
        "email",
        "id",
        "name",
        "preferences",
      ]);
    });
  });
});
