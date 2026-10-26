import bcrypt from "bcrypt";
import NotFoundError from "../../../shared/errors/NotFoundError.js";
import ValidationError from "../../../shared/errors/ValidationError.js";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import sendPasswordResetEmail from "../../../shared/email/sendPasswordResetEmail.js";
import sendVerificationEmail from "../../../shared/email/sendVerificationEmail.js";
import {
  createAccessToken,
  createRawToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../../utils/tokens.js";
import User from "../model/User.js";
import mapUserDocumentToDto, {
  mapPreferencesToDto,
} from "../mapper/mapUserDocumentToDto.js";
import validateAvatarBody from "../validator/validateAvatarBody.js";
import validateForgotPasswordDto from "../validator/validateForgotPasswordDto.js";
import validateLoginDto from "../validator/validateLoginDto.js";
import validateRegisterDto from "../validator/validateRegisterDto.js";
import validateResetPasswordDto from "../validator/validateResetPasswordDto.js";
import validateUpdateProfileDto from "../validator/validateUpdateProfileDto.js";
import validateUpdatePreferencesDto from "../validator/validateUpdatePreferencesDto.js";
import {
  AVATAR_CONTENT_TYPE,
  type AvatarFile,
  type PreferencesDto,
  type SessionTokens,
  type UserDto,
} from "../types/types.js";

const BCRYPT_COST = 12;
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface RegisterUserResult {
  user: UserDto;
  session: SessionTokens;
}

export interface LoginUserResult {
  user: UserDto;
  session: SessionTokens;
}

const createSessionTokens = (userId: string): SessionTokens => ({
  accessToken: createAccessToken({ userId }),
  refreshToken: createRefreshToken({ userId }),
});

// Abre una sesión nueva y guarda el hash del refresh token vigente. Solo hay
// un hash por usuario (modelo-de-datos.md): iniciar sesión en otro dispositivo
// sustituye al anterior.
const startSession = async (userId: string): Promise<SessionTokens> => {
  const session = createSessionTokens(userId);

  await User.updateOne(
    { _id: userId },
    { refreshTokenHash: hashToken(session.refreshToken) },
  );

  return session;
};

const unauthenticatedError = () =>
  new UnauthorizedError(
    "AUTH_UNAUTHENTICATED",
    "La sesión no es válida o ha caducado",
  );

// Hash válido contra el que comparar cuando el email no existe: así el tiempo
// de respuesta no delata si la cuenta está registrada.
let dummyPasswordHash: Promise<string> | undefined;
const getDummyPasswordHash = (): Promise<string> => {
  dummyPasswordHash ??= bcrypt.hash(createRawToken(), BCRYPT_COST);

  return dummyPasswordHash;
};

const registerUser = async (body: unknown): Promise<RegisterUserResult> => {
  const dto = validateRegisterDto(body);

  const existingUser = await User.findOne({ email: dto.email });

  if (existingUser) {
    throw new ValidationError(
      "AUTH_EMAIL_TAKEN",
      "Ya existe una cuenta con este email",
      "email",
    );
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

  const verificationToken = createRawToken();
  const emailVerificationTokenHash = hashToken(verificationToken);
  const emailVerificationTokenExpiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS,
  );

  const user = await User.create({
    name: dto.name,
    email: dto.email,
    passwordHash,
    acceptedTermsAt: new Date(),
    emailVerificationTokenHash,
    emailVerificationTokenExpiresAt,
  });

  await sendVerificationEmail(user.email, verificationToken);

  const session = await startSession(user.id);

  return { user: mapUserDocumentToDto(user), session };
};

const loginUser = async (body: unknown): Promise<LoginUserResult> => {
  const dto = validateLoginDto(body);

  const user = await User.findOne({ email: dto.email });

  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const isPasswordValid = await bcrypt.compare(dto.password, passwordHash);

  if (!user || !isPasswordValid) {
    throw new UnauthorizedError(
      "AUTH_INVALID_CREDENTIALS",
      "El email o la contraseña no son correctos",
    );
  }

  const session = await startSession(user.id);

  return { user: mapUserDocumentToDto(user), session };
};

const getCurrentUser = async (userId: string): Promise<UserDto> => {
  const user = await User.findById(userId);

  if (!user) {
    throw unauthenticatedError();
  }

  return mapUserDocumentToDto(user);
};

const updateProfile = async (
  userId: string,
  body: unknown,
): Promise<UserDto> => {
  const dto = validateUpdateProfileDto(body);

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { name: dto.name } },
    { returnDocument: "after" },
  );

  if (!user) {
    throw unauthenticatedError();
  }

  return mapUserDocumentToDto(user);
};

const uploadAvatar = async (
  userId: string,
  body: unknown,
): Promise<UserDto> => {
  const data = validateAvatarBody(body);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        avatar: {
          data,
          contentType: AVATAR_CONTENT_TYPE,
          updatedAt: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  );

  if (!user) {
    throw unauthenticatedError();
  }

  return mapUserDocumentToDto(user);
};

const getAvatar = async (userId: string): Promise<AvatarFile> => {
  const user = await User.findById(userId).select("+avatar.data");

  if (!user) {
    throw unauthenticatedError();
  }

  if (!user.avatar?.data || !user.avatar.contentType) {
    throw new NotFoundError("AVATAR_NOT_FOUND", "No tienes foto de perfil");
  }

  return { data: user.avatar.data, contentType: user.avatar.contentType };
};

// Idempotente: quitar una foto que no existe no es un error.
const removeAvatar = async (userId: string): Promise<void> => {
  const user = await User.findByIdAndUpdate(userId, { $unset: { avatar: "" } });

  if (!user) {
    throw unauthenticatedError();
  }
};

const updatePreferences = async (
  userId: string,
  body: unknown,
): Promise<PreferencesDto> => {
  const dto = validateUpdatePreferencesDto(body);

  const user = await User.findByIdAndUpdate(
    userId,
    dto.libraryView
      ? { $set: { "preferences.libraryView": dto.libraryView } }
      : {},
    { returnDocument: "after" },
  );

  if (!user) {
    throw unauthenticatedError();
  }

  return mapPreferencesToDto(user);
};

// Idempotente: solo se guarda la fecha la primera vez, así que llamarlo de nuevo
// no la cambia ni da error.
const completeOnboarding = async (userId: string): Promise<void> => {
  const result = await User.updateOne(
    { _id: userId, onboardingCompletedAt: { $exists: false } },
    { $set: { onboardingCompletedAt: new Date() } },
  );

  if (result.matchedCount === 0 && !(await User.exists({ _id: userId }))) {
    throw unauthenticatedError();
  }
};

// Rota el refresh token: el presentado solo sirve si su hash es el vigente y
// se sustituye de forma atómica por el nuevo. Si el token está bien firmado
// pero su hash ya no es el vigente, alguien lo está reutilizando (señal de
// robo): se revoca la sesión del usuario.
const refreshSession = async (
  refreshToken: string | undefined,
): Promise<SessionTokens> => {
  if (!refreshToken) {
    throw unauthenticatedError();
  }

  const { userId } = verifyRefreshToken(refreshToken);
  const session = createSessionTokens(userId);

  const rotatedUser = await User.findOneAndUpdate(
    { _id: userId, refreshTokenHash: hashToken(refreshToken) },
    { refreshTokenHash: hashToken(session.refreshToken) },
  );

  if (!rotatedUser) {
    await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });

    throw unauthenticatedError();
  }

  return session;
};

// Con un accessToken caducado el usuario sigue pudiendo cerrar sesión (el
// frontend borra las cookies igualmente), así que no se exige sesión válida:
// solo se invalida el refresh token cuando se puede identificar al usuario.
const logoutUser = async (accessToken: string | undefined): Promise<void> => {
  if (!accessToken) {
    return;
  }

  try {
    const { userId } = verifyAccessToken(accessToken);

    await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      throw error;
    }
  }
};

const verifyEmail = async (token: string): Promise<void> => {
  const emailVerificationTokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash,
    emailVerificationTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    throw new ValidationError(
      "AUTH_INVALID_TOKEN",
      "El enlace de verificación no es válido o ha caducado",
    );
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationTokenExpiresAt = undefined;

  await user.save();
};

// Resuelve igual exista o no el email (api-contract.md): nunca revela si una
// cuenta está registrada.
const requestPasswordReset = async (body: unknown): Promise<void> => {
  const dto = validateForgotPasswordDto(body);

  const resetToken = createRawToken();

  const user = await User.findOneAndUpdate(
    { email: dto.email },
    {
      passwordResetTokenHash: hashToken(resetToken),
      passwordResetTokenExpiresAt: new Date(
        Date.now() + PASSWORD_RESET_TOKEN_TTL_MS,
      ),
    },
  );

  if (user) {
    await sendPasswordResetEmail(user.email, resetToken);
  }
};

// El token se consume en la misma operación atómica que cambia la contraseña,
// así es de un solo uso aunque lleguen dos peticiones a la vez. Además revoca
// la sesión abierta: si alguien la había robado, deja de servirle.
const resetPassword = async (body: unknown): Promise<void> => {
  const dto = validateResetPasswordDto(body);

  const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);

  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: hashToken(dto.token),
      passwordResetTokenExpiresAt: { $gt: new Date() },
    },
    {
      passwordHash,
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetTokenExpiresAt: 1,
        refreshTokenHash: 1,
      },
    },
  );

  if (!user) {
    throw new ValidationError(
      "AUTH_INVALID_TOKEN",
      "El enlace de recuperación no es válido o ha caducado",
    );
  }
};

const AuthService = {
  registerUser,
  verifyEmail,
  loginUser,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  getAvatar,
  removeAvatar,
  updatePreferences,
  completeOnboarding,
  refreshSession,
  logoutUser,
  requestPasswordReset,
  resetPassword,
};

export default AuthService;
