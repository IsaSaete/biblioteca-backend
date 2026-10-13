import AppError from "./AppError.js";

class UnauthorizedError extends AppError {
  readonly httpStatus = 401;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default UnauthorizedError;
