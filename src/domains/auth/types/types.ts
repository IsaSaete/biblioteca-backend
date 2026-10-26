export interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

export const LIBRARY_VIEWS = ["grid", "list"] as const;

export const DEFAULT_LIBRARY_VIEW = "grid";

export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export interface PreferencesDto {
  libraryView: LibraryView;
}

// Cambia solo lo que se envía; un body vacío no cambia nada.
export interface UpdatePreferencesDto {
  libraryView?: LibraryView;
}

export const AVATAR_CONTENT_TYPE = "image/jpeg";

export const AVATAR_MAX_BYTES = 200 * 1024;

export interface UpdateProfileDto {
  name: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  preferences: PreferencesDto;
}

export interface LoginUserDto {
  email: string;
  password: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}
