import AppError from "./AppError.js";

class PayloadTooLargeError extends AppError {
  readonly httpStatus = 413;

  constructor(code: string, message: string, field?: string) {
    super(code, message, field);
  }
}

export default PayloadTooLargeError;
