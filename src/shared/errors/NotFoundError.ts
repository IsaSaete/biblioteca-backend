import AppError from "./AppError.js";

class NotFoundError extends AppError {
  readonly httpStatus = 404;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default NotFoundError;
