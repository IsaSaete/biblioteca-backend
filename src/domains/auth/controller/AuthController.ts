import type { NextFunction, Request, Response } from "express";
import ValidationError from "../../../shared/errors/ValidationError.js";
import setSessionCookies from "../../../utils/setSessionCookies.js";
import AuthService from "../service/AuthService.js";

const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { user } = await AuthService.registerUser(req.body);

    setSessionCookies(res, { userId: user.id });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token } = req.query;

    if (typeof token !== "string" || token.length === 0) {
      throw new ValidationError(
        "AUTH_INVALID_TOKEN",
        "El enlace de verificación no es válido o ha caducado",
      );
    }

    await AuthService.verifyEmail(token);

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};

const AuthController = { register, verifyEmail };

export default AuthController;
