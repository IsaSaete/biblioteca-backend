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

export const NEW_VALID_PASSWORD = "N3w!Password";

// Cabecera JPEG mínima (FF D8 FF) con relleno hasta el tamaño pedido.
export const buildJpegBuffer = (size = 1024): Buffer =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(Math.max(size - 4, 0), 1),
  ]);
