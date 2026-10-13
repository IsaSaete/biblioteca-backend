import bcrypt from "bcrypt";
import ValidationError from "../../../shared/errors/ValidationError.js";
import sendVerificationEmail from "../../../shared/email/sendVerificationEmail.js";
import { createRawToken, hashToken } from "../../../utils/tokens.js";
import User from "../model/User.js";
import mapUserDocumentToDto from "../mapper/mapUserDocumentToDto.js";
import validateRegisterDto from "../validator/validateRegisterDto.js";
import type { UserDto } from "../types/types.js";

const BCRYPT_COST = 12;
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterUserResult {
  user: UserDto;
}

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

  return { user: mapUserDocumentToDto(user) };
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

const AuthService = { registerUser, verifyEmail };

export default AuthService;
