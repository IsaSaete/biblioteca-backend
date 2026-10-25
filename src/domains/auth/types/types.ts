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

export interface UserDto {
  id: string;
  name: string;
  email: string;
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
