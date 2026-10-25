import { Schema, model, type InferSchemaType } from "mongoose";
import { LIBRARY_VIEWS } from "../types/types.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, required: true, default: false },
    acceptedTermsAt: { type: Date, required: true },
    avatarUrl: { type: String },
    // Las cuentas anteriores a este campo no lo tienen: el valor por defecto se
    // aplica al leer, sin migración.
    preferences: {
      libraryView: { type: String, enum: LIBRARY_VIEWS },
    },
    refreshTokenHash: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetTokenExpiresAt: { type: Date },
    emailVerificationTokenHash: { type: String },
    emailVerificationTokenExpiresAt: { type: Date },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

const User = model("User", userSchema);

export default User;
