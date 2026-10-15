import { jest } from "@jest/globals";
import bcrypt from "bcrypt";
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

describe("Given the AuthService.registerUser function", () => {
  describe("When it receives valid data with a new email", () => {
    it("Then it should return the user without sensitive fields", async () => {
      const dto = buildRegisterDto();

      const result = await AuthService.registerUser(dto);

      expect(result.user).toEqual({
        id: expect.any(String),
        name: dto.name,
        email: dto.email,
      });
    });

    it("Then it should store the user with a hashed password, emailVerified as false and the terms acceptance date", async () => {
      const dto = buildRegisterDto();

      await AuthService.registerUser(dto);

      const storedUser = await User.findOne({ email: dto.email });
      expect(storedUser).not.toBeNull();
      expect(storedUser?.passwordHash).not.toBe(dto.password);
      expect(
        await bcrypt.compare(dto.password, storedUser?.passwordHash ?? ""),
      ).toBe(true);
      expect(storedUser?.emailVerified).toBe(false);
      expect(storedUser?.acceptedTermsAt).toBeInstanceOf(Date);
    });

    it("Then it should send the verification email with a token", async () => {
      const dto = buildRegisterDto();

      await AuthService.registerUser(dto);

      expect(sendVerificationEmailMock).toHaveBeenCalledWith(
        dto.email,
        expect.any(String),
      );
    });
  });

  describe("When it receives an email that is already registered", () => {
    it("Then it should fail with AUTH_EMAIL_TAKEN", async () => {
      const dto = buildRegisterDto();
      await AuthService.registerUser(dto);

      const act = () => AuthService.registerUser(dto);

      await expect(act()).rejects.toMatchObject({ code: "AUTH_EMAIL_TAKEN" });
    });
  });

  describe("When it receives a weak password", () => {
    it.each([
      ["too short", "Ab1!"],
      ["without an uppercase letter", "str0ng!pass"],
      ["without a number", "Strong!Pass"],
      ["without a symbol", "Str0ngPass"],
    ])(
      "Then it should fail with AUTH_WEAK_PASSWORD when the password is %s",
      async (_description, password) => {
        const dto = buildRegisterDto({ password });

        const act = () => AuthService.registerUser(dto);

        await expect(act()).rejects.toMatchObject({
          code: "AUTH_WEAK_PASSWORD",
        });
      },
    );
  });

  describe("When it receives acceptedTerms as false", () => {
    it("Then it should fail with a validation error", async () => {
      const dto = buildRegisterDto({ acceptedTerms: false });

      const act = () => AuthService.registerUser(dto);

      await expect(act()).rejects.toMatchObject({ httpStatus: 400 });
    });
  });
});
