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

describe("AuthService.registerUser", () => {
  it("Given un email nuevo y datos válidos, when se registra el usuario, then se crea con la contraseña hasheada y emailVerified en false", async () => {
    // Arrange
    const dto = buildRegisterDto();

    // Act
    const result = await AuthService.registerUser(dto);

    // Assert
    expect(result.user).toEqual({
      id: expect.any(String),
      name: dto.name,
      email: dto.email,
    });

    const storedUser = await User.findOne({ email: dto.email });
    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe(dto.password);
    expect(
      await bcrypt.compare(dto.password, storedUser?.passwordHash ?? ""),
    ).toBe(true);
    expect(storedUser?.emailVerified).toBe(false);
    expect(storedUser?.acceptedTermsAt).toBeInstanceOf(Date);
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      dto.email,
      expect.any(String),
    );
  });

  it("Given un email ya registrado, when se intenta registrar, then falla con AUTH_EMAIL_TAKEN", async () => {
    // Arrange
    const dto = buildRegisterDto();
    await AuthService.registerUser(dto);

    // Act
    const act = () => AuthService.registerUser(dto);

    // Assert
    await expect(act()).rejects.toMatchObject({ code: "AUTH_EMAIL_TAKEN" });
  });

  it.each([
    ["short", "Ab1!", "AUTH_WEAK_PASSWORD"],
    ["sin mayúscula", "str0ng!pass", "AUTH_WEAK_PASSWORD"],
    ["sin número", "Strong!Pass", "AUTH_WEAK_PASSWORD"],
    ["sin símbolo", "Str0ngPass", "AUTH_WEAK_PASSWORD"],
  ])(
    "Given una contraseña %s, when se intenta registrar, then falla con %s",
    async (_description, password, expectedCode) => {
      // Arrange
      const dto = buildRegisterDto({ password });

      // Act
      const act = () => AuthService.registerUser(dto);

      // Assert
      await expect(act()).rejects.toMatchObject({ code: expectedCode });
    },
  );

  it("Given acceptedTerms en false, when se intenta registrar, then falla con un error de validación", async () => {
    // Arrange
    const dto = buildRegisterDto({ acceptedTerms: false });

    // Act
    const act = () => AuthService.registerUser(dto);

    // Assert
    await expect(act()).rejects.toMatchObject({ httpStatus: 400 });
  });
});
