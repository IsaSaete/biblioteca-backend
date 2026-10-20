import AppError from "./AppError.js";

class ConflictError extends AppError {
  readonly httpStatus = 409;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default ConflictError;
