abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

export default AppError;
