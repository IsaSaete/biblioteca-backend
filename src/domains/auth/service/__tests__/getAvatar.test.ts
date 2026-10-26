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

describe("Given the AuthService.getAvatar function", () => {
  describe("When the user has a photo", () => {
    it("Then it should return the stored bytes and their content type", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const jpeg = buildJpegBuffer();
      await AuthService.uploadAvatar(user.id, jpeg);

      const avatar = await AuthService.getAvatar(user.id);

      expect(avatar.contentType).toBe("image/jpeg");
      expect(avatar.data.equals(jpeg)).toBe(true);
    });
  });

  describe("When the user has no photo", () => {
    it("Then it should fail with AVATAR_NOT_FOUND", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(AuthService.getAvatar(user.id)).rejects.toMatchObject({
        code: "AVATAR_NOT_FOUND",
        httpStatus: 404,
      });
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(AuthService.getAvatar(unknownId)).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
