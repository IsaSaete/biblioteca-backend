import AppError from "./AppError.js";

class ValidationError extends AppError {
  readonly httpStatus = 400;

  constructor(code: string, message: string, field?: string) {
    super(code, message, field);
  }
}

export default ValidationError;
