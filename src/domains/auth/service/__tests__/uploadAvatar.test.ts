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

describe("Given the AuthService.uploadAvatar function", () => {
  describe("When the user sends a valid JPEG", () => {
    it("Then it should store the bytes and return the user with an avatarUrl", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const jpeg = buildJpegBuffer();

      const updated = await AuthService.uploadAvatar(user.id, jpeg);

      const stored = await User.findById(user.id).select("+avatar.data");
      expect(updated.avatarUrl).toMatch(/^\/api\/auth\/me\/avatar\?v=\d+$/);
      expect(stored?.avatar?.contentType).toBe("image/jpeg");
      expect(stored?.avatar?.data?.equals(jpeg)).toBe(true);
    });
  });

  describe("When the user already had a photo", () => {
    it("Then it should replace it", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.uploadAvatar(user.id, buildJpegBuffer(512));
      const second = buildJpegBuffer(2048);

      await AuthService.uploadAvatar(user.id, second);

      const stored = await User.findById(user.id).select("+avatar.data");
      expect(stored?.avatar?.data?.equals(second)).toBe(true);
    });
  });

  describe("When the photo is exactly 200 KB", () => {
    it("Then it should accept it", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const updated = await AuthService.uploadAvatar(
        user.id,
        buildJpegBuffer(200 * 1024),
      );

      expect(updated.avatarUrl).not.toBeNull();
    });
  });

  describe.each([
    ["missing", undefined],
    ["an empty object (not sent as image/jpeg)", {}],
    ["an empty buffer", Buffer.alloc(0)],
    ["larger than 200 KB", buildJpegBuffer(200 * 1024 + 1)],
    ["not a JPEG", Buffer.from("<svg></svg>")],
  ])("When the body is %s", (_case, body) => {
    it("Then it should fail with VALIDATION_ERROR on avatar and keep the account without photo", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.uploadAvatar(user.id, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "avatar" });
      expect((await User.findById(user.id))?.avatar?.updatedAt).toBeUndefined();
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.uploadAvatar(unknownId, buildJpegBuffer()),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
