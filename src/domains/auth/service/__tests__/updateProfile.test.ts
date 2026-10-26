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

describe("Given the AuthService.updateProfile function", () => {
  describe("When the user sends a new name", () => {
    it("Then it should return the user with the new name and store it", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const updated = await AuthService.updateProfile(user.id, {
        name: "Isabel",
      });

      expect(updated).toMatchObject({ id: user.id, name: "Isabel" });
      expect((await User.findById(user.id))?.name).toBe("Isabel");
    });
  });

  describe("When the name has surrounding spaces", () => {
    it("Then it should store it trimmed", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const updated = await AuthService.updateProfile(user.id, {
        name: "  Isabel  ",
      });

      expect(updated.name).toBe("Isabel");
    });
  });

  describe("When the name has exactly 80 characters", () => {
    it("Then it should accept it", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const name = "a".repeat(80);

      expect((await AuthService.updateProfile(user.id, { name })).name).toBe(
        name,
      );
    });
  });

  describe.each([
    ["missing", {}],
    ["empty", { name: "" }],
    ["only spaces", { name: "   " }],
    ["longer than 80 characters", { name: "a".repeat(81) }],
    ["not a string", { name: 3 }],
    ["null", { name: null }],
  ])("When the name is %s", (_case, body) => {
    it("Then it should fail with VALIDATION_ERROR on name and keep the stored name", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.updateProfile(user.id, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "name" });
      expect((await User.findById(user.id))?.name).toBe("Isa");
    });
  });

  describe("When the body also carries fields that are not the name", () => {
    it("Then it should ignore them and not touch the account", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.updateProfile(user.id, {
        name: "Isabel",
        email: "otro@example.com",
      });

      expect((await User.findById(user.id))?.email).toBe("isa@example.com");
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.updateProfile(unknownId, { name: "Isabel" }),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
