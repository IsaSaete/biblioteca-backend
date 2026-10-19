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
const { hashToken } = await import("../../../../utils/tokens.js");
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

describe("Given the AuthService.getCurrentUser function", () => {
  describe("When it receives the id of an existing user", () => {
    it("Then it should return the user without sensitive fields", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const result = await AuthService.getCurrentUser(user.id);

      expect(result).toEqual(user);
    });
  });

  describe("When it receives the id of a user that no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      const result = AuthService.getCurrentUser(unknownId);

      await expect(result).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});

describe("Given the AuthService.refreshSession function", () => {
  describe("When it receives the current refresh token", () => {
    it("Then it should return new tokens and store the hash of the new refresh token", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());

      const newSession = await AuthService.refreshSession(session.refreshToken);

      expect(newSession.refreshToken).not.toBe(session.refreshToken);
      const storedUser = await User.findById(user.id);
      expect(storedUser?.refreshTokenHash).toBe(
        hashToken(newSession.refreshToken),
      );
    });
  });

  describe("When it receives a refresh token that was already rotated", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED and revoke the user's session", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());
      const newSession = await AuthService.refreshSession(session.refreshToken);

      const result = AuthService.refreshSession(session.refreshToken);

      await expect(result).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
      });
      const storedUser = await User.findById(user.id);
      expect(storedUser?.refreshTokenHash).toBeUndefined();
      await expect(
        AuthService.refreshSession(newSession.refreshToken),
      ).rejects.toMatchObject({ code: "AUTH_UNAUTHENTICATED" });
    });
  });

  describe("When it receives the same refresh token twice at the same time", () => {
    it("Then only one of the two rotations succeeds", async () => {
      const { session } = await AuthService.registerUser(buildRegisterDto());

      const results = await Promise.allSettled([
        AuthService.refreshSession(session.refreshToken),
        AuthService.refreshSession(session.refreshToken),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);
    });
  });

  describe("When it receives a token that is not a valid refresh token", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const { session } = await AuthService.registerUser(buildRegisterDto());

      // Un access token está firmado con otro secreto: no vale como refresh.
      const result = AuthService.refreshSession(session.accessToken);

      await expect(result).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
      });
    });
  });

  describe("When it receives no token", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const result = AuthService.refreshSession(undefined);

      await expect(result).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
      });
    });
  });
});

describe("Given the AuthService.logoutUser function", () => {
  describe("When it receives a valid access token", () => {
    it("Then it should clear the stored refresh token hash", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());

      await AuthService.logoutUser(session.accessToken);

      const storedUser = await User.findById(user.id);
      expect(storedUser?.refreshTokenHash).toBeUndefined();
    });
  });

  describe("When it receives an invalid access token or none", () => {
    it("Then it should resolve without touching any user", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.logoutUser("not-a-token");
      await AuthService.logoutUser(undefined);

      const storedUser = await User.findById(user.id);
      expect(storedUser?.refreshTokenHash).toBeDefined();
    });
  });
});
