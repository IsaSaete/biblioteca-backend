import type { RegisterUserDto } from "../types/types.js";

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
