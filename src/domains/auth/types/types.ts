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
