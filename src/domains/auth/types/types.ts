export interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
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
