import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
  buildJpegBuffer,
  buildRegisterDto,
} from "../../fixtures/auth.fixtures.js";

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

describe("Given the AuthService.removeAvatar function", () => {
  describe("When the user has a photo", () => {
    it("Then it should remove it and avatarUrl should go back to null", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.uploadAvatar(user.id, buildJpegBuffer());

      await AuthService.removeAvatar(user.id);

      const stored = await User.findById(user.id).select("+avatar.data");
      expect(stored?.avatar?.data).toBeUndefined();
      expect((await AuthService.getCurrentUser(user.id)).avatarUrl).toBeNull();
    });
  });

  describe("When the user has no photo", () => {
    it("Then it should not fail", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(AuthService.removeAvatar(user.id)).resolves.toBeUndefined();
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(AuthService.removeAvatar(unknownId)).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
