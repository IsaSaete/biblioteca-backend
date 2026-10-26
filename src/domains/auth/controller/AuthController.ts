import type { NextFunction, Request, Response } from "express";
import ValidationError from "../../../shared/errors/ValidationError.js";
import UnauthorizedError from "../../../shared/errors/UnauthorizedError.js";
import {
  clearSessionCookies,
  setSessionCookies,
} from "../../../utils/setSessionCookies.js";
import AuthService from "../service/AuthService.js";

const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { user, session } = await AuthService.registerUser(req.body);

    setSessionCookies(res, session);

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

const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { user, session } = await AuthService.loginUser(req.body);

    setSessionCookies(res, session);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const me = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // authMiddleware garantiza userId; la comprobación estrecha el tipo.
    if (!req.userId) {
      throw new UnauthorizedError(
        "AUTH_UNAUTHENTICATED",
        "Necesitas iniciar sesión para acceder a este recurso",
      );
    }

    const user = await AuthService.getCurrentUser(req.userId);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // authMiddleware garantiza userId; la comprobación estrecha el tipo.
    if (!req.userId) {
      throw new UnauthorizedError(
        "AUTH_UNAUTHENTICATED",
        "Necesitas iniciar sesión para acceder a este recurso",
      );
    }

    const user = await AuthService.updateProfile(req.userId, req.body);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const updatePreferences = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // authMiddleware garantiza userId; la comprobación estrecha el tipo.
    if (!req.userId) {
      throw new UnauthorizedError(
        "AUTH_UNAUTHENTICATED",
        "Necesitas iniciar sesión para acceder a este recurso",
      );
    }

    const preferences = await AuthService.updatePreferences(
      req.userId,
      req.body,
    );

    res.status(200).json({ preferences });
  } catch (error) {
    next(error);
  }
};

const completeOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // authMiddleware garantiza userId; la comprobación estrecha el tipo.
    if (!req.userId) {
      throw new UnauthorizedError(
        "AUTH_UNAUTHENTICATED",
        "Necesitas iniciar sesión para acceder a este recurso",
      );
    }

    await AuthService.completeOnboarding(req.userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshToken: unknown = req.cookies?.refreshToken;

    const session = await AuthService.refreshSession(
      typeof refreshToken === "string" ? refreshToken : undefined,
    );

    setSessionCookies(res, session, { rotateCsrfToken: false });

    res.status(200).end();
  } catch (error) {
    // Un refresh token inválido o reutilizado no debe dejar cookies de sesión
    // viejas en el navegador.
    if (error instanceof UnauthorizedError) {
      clearSessionCookies(res);
    }

    next(error);
  }
};

const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const accessToken: unknown = req.cookies?.accessToken;

    await AuthService.logoutUser(
      typeof accessToken === "string" ? accessToken : undefined,
    );

    clearSessionCookies(res);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await AuthService.requestPasswordReset(req.body);

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await AuthService.resetPassword(req.body);

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};

const AuthController = {
  register,
  verifyEmail,
  login,
  me,
  updateProfile,
  updatePreferences,
  completeOnboarding,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
};

export default AuthController;
