import AppError from "./AppError.js";

class ForbiddenError extends AppError {
  readonly httpStatus = 403;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default ForbiddenError;
