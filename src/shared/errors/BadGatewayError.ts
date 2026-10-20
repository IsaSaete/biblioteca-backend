import AppError from "./AppError.js";

class BadGatewayError extends AppError {
  readonly httpStatus = 502;

  constructor(code: string, message: string) {
    super(code, message);
  }
}

export default BadGatewayError;
