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

describe("AuthService.verifyEmail", () => {
  it("Given un token de verificación válido, when se verifica el email, then emailVerified pasa a true y el token queda invalidado", async () => {
    // Arrange
    const dto = buildRegisterDto();
    const { user } = await AuthService.registerUser(dto);
    const token = getLastSentVerificationToken();

    // Act
    await AuthService.verifyEmail(token);

    // Assert
    const storedUser = await User.findById(user.id);
    expect(storedUser?.emailVerified).toBe(true);
    expect(storedUser?.emailVerificationTokenHash).toBeUndefined();
    expect(storedUser?.emailVerificationTokenExpiresAt).toBeUndefined();
  });

  it("Given un token ya usado, when se intenta verificar de nuevo, then falla con AUTH_INVALID_TOKEN", async () => {
    // Arrange
    const dto = buildRegisterDto();
    await AuthService.registerUser(dto);
    const token = getLastSentVerificationToken();
    await AuthService.verifyEmail(token);

    // Act
    const act = () => AuthService.verifyEmail(token);

    // Assert
    await expect(act()).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });

  it("Given un token caducado, when se intenta verificar, then falla con AUTH_INVALID_TOKEN", async () => {
    // Arrange
    const dto = buildRegisterDto();
    const { user } = await AuthService.registerUser(dto);
    const token = getLastSentVerificationToken();
    await User.findByIdAndUpdate(user.id, {
      emailVerificationTokenExpiresAt: new Date(Date.now() - 1000),
    });

    // Act
    const act = () => AuthService.verifyEmail(token);

    // Assert
    await expect(act()).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });

  it("Given un token que no existe, when se intenta verificar, then falla con AUTH_INVALID_TOKEN", async () => {
    // Arrange
    const act = () => AuthService.verifyEmail("un-token-inventado");

    // Act / Assert
    await expect(act()).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
  });
});
