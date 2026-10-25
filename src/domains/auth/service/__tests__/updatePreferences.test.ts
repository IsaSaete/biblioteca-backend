import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { default: mongoose } = await import("mongoose");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

describe("Given the AuthService.updatePreferences function", () => {
  describe("When the user chooses the list view", () => {
    it("Then it should return the preferences and store them, visible in getCurrentUser", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const preferences = await AuthService.updatePreferences(user.id, {
        libraryView: "list",
      });

      expect(preferences).toEqual({ libraryView: "list" });
      expect((await AuthService.getCurrentUser(user.id)).preferences).toEqual({
        libraryView: "list",
      });
    });
  });

  describe("When the user goes back to the grid view", () => {
    it("Then it should store grid", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.updatePreferences(user.id, { libraryView: "list" });

      const preferences = await AuthService.updatePreferences(user.id, {
        libraryView: "grid",
      });

      expect(preferences).toEqual({ libraryView: "grid" });
    });
  });

  describe("When the body is empty", () => {
    it("Then it should return the current preferences without changing them", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.updatePreferences(user.id, { libraryView: "list" });

      expect(await AuthService.updatePreferences(user.id, {})).toEqual({
        libraryView: "list",
      });
    });
  });

  describe("When the account never chose a view", () => {
    it("Then an empty body should return the default grid", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      expect(await AuthService.updatePreferences(user.id, {})).toEqual({
        libraryView: "grid",
      });
    });
  });

  describe.each([
    ["an unknown view", { libraryView: "tabla" }],
    ["a view that is not a string", { libraryView: 3 }],
    ["null", { libraryView: null }],
  ])("When libraryView is %s", (_case, body) => {
    it("Then it should fail with VALIDATION_ERROR on libraryView and keep the stored value", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.updatePreferences(user.id, { libraryView: "list" });

      await expect(
        AuthService.updatePreferences(user.id, body),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        field: "libraryView",
      });
      expect((await User.findById(user.id))?.preferences?.libraryView).toBe(
        "list",
      );
    });
  });

  describe("When the body also carries fields that are not preferences", () => {
    it("Then it should ignore them and not touch the account", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.updatePreferences(user.id, {
        libraryView: "list",
        name: "Otra persona",
        email: "otro@example.com",
      });

      const stored = await User.findById(user.id);
      expect(stored?.name).toBe("Isa");
      expect(stored?.email).toBe("isa@example.com");
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.updatePreferences(unknownId, { libraryView: "list" }),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
