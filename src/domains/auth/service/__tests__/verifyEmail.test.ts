import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

const sendVerificationEmailMock = jest
  .fn<(to: string, token: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: sendVerificationEmailMock,
  }),
);

const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
  sendVerificationEmailMock.mockClear();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const getLastSentVerificationToken = (): string => {
  const [, token] = sendVerificationEmailMock.mock.calls[0] as [string, string];
  return token;
};

describe("Given the AuthService.verifyEmail function", () => {
  describe("When it receives a valid verification token", () => {
    it("Then it should set emailVerified to true and invalidate the token", async () => {
      const dto = buildRegisterDto();
      const { user } = await AuthService.registerUser(dto);
      const token = getLastSentVerificationToken();

      await AuthService.verifyEmail(token);

      const storedUser = await User.findById(user.id);
      expect(storedUser?.emailVerified).toBe(true);
      expect(storedUser?.emailVerificationTokenHash).toBeUndefined();
      expect(storedUser?.emailVerificationTokenExpiresAt).toBeUndefined();
    });
  });

  describe("When it receives a token that has already been used", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const dto = buildRegisterDto();
      await AuthService.registerUser(dto);
      const token = getLastSentVerificationToken();
      await AuthService.verifyEmail(token);

      const act = () => AuthService.verifyEmail(token);

      await expect(act()).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });

  describe("When it receives an expired token", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const dto = buildRegisterDto();
      const { user } = await AuthService.registerUser(dto);
      const token = getLastSentVerificationToken();
      await User.findByIdAndUpdate(user.id, {
        emailVerificationTokenExpiresAt: new Date(Date.now() - 1000),
      });

      const act = () => AuthService.verifyEmail(token);

      await expect(act()).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });

  describe("When it receives a token that does not exist", () => {
    it("Then it should fail with AUTH_INVALID_TOKEN", async () => {
      const act = () => AuthService.verifyEmail("made-up-token");

      await expect(act()).rejects.toMatchObject({
        code: "AUTH_INVALID_TOKEN",
      });
    });
  });
});
