import AppError from "./AppError.js";

class TooManyRequestsError extends AppError {
  readonly httpStatus = 429;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default TooManyRequestsError;
