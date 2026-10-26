import { Schema, model, type InferSchemaType } from "mongoose";
import { LIBRARY_VIEWS } from "../types/types.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, required: true, default: false },
    acceptedTermsAt: { type: Date, required: true },
    // Foto 256×256 guardada en el propio documento (D-032). Solo `data` lleva
    // select:false: así contentType y updatedAt bastan para derivar avatarUrl
    // sin cargar los bytes en cada consulta.
    avatar: {
      data: { type: Buffer, select: false },
      contentType: { type: String, enum: ["image/jpeg"] },
      updatedAt: { type: Date },
    },
    // Fecha en la que completó o saltó el onboarding; ausente = aún no lo ha visto.
    onboardingCompletedAt: { type: Date },
    // Las cuentas anteriores a este campo no lo tienen: el valor por defecto se
    // aplica al leer, sin migración.
    preferences: {
      libraryView: { type: String, enum: LIBRARY_VIEWS },
    },
    refreshTokenHash: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetTokenExpiresAt: { type: Date },
    // Email nuevo a la espera de confirmar (D-032): `email` no cambia hasta
    // que se abre el enlace enviado a esta dirección.
    pendingEmail: { type: String, lowercase: true },
    pendingEmailTokenHash: { type: String },
    pendingEmailTokenExpiresAt: { type: Date },
    emailVerificationTokenHash: { type: String },
    emailVerificationTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

const User = model("User", userSchema);

export default User;
