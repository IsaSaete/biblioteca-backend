import type { LoginUserDto, RegisterUserDto } from "../types/types.js";

export const validRegisterDto: RegisterUserDto = {
  name: "Isa",
  email: "isa@example.com",
  password: "Str0ng!Pass",
  acceptedTerms: true,
};

export const buildRegisterDto = (
  overrides: Partial<RegisterUserDto> = {},
): RegisterUserDto => ({
  ...validRegisterDto,
  ...overrides,
});

export const validLoginDto: LoginUserDto = {
  email: validRegisterDto.email,
  password: validRegisterDto.password,
};

export const buildLoginDto = (
  overrides: Partial<LoginUserDto> = {},
): LoginUserDto => ({
  ...validLoginDto,
  ...overrides,
});
