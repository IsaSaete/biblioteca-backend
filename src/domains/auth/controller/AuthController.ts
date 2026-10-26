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

const uploadAvatar = async (
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

    const user = await AuthService.uploadAvatar(req.userId, req.body);

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

const getAvatar = async (
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

    const { data, contentType } = await AuthService.getAvatar(req.userId);

    // res.send calcula el ETag y responde 304 si el cliente ya lo tiene.
    res.set("Cache-Control", "private").type(contentType).send(data);
  } catch (error) {
    next(error);
  }
};

const removeAvatar = async (
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

    await AuthService.removeAvatar(req.userId);

    res.status(204).send();
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

const changePassword = async (
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

    const session = await AuthService.changePassword(req.userId, req.body);

    setSessionCookies(res, session);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const requestEmailChange = async (
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

    await AuthService.requestEmailChange(req.userId, req.body);

    res.status(202).send();
  } catch (error) {
    next(error);
  }
};

const confirmEmailChange = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { token } = req.query;

    if (typeof token !== "string" || token.length === 0) {
      throw new ValidationError(
        "AUTH_INVALID_TOKEN",
        "El enlace de confirmación no es válido o ha caducado",
      );
    }

    await AuthService.confirmEmailChange(token);

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};

const exportData = async (
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

    const data = await AuthService.exportData(req.userId);

    // Datos personales: que ninguna caché intermedia los guarde.
    res
      .set("Content-Disposition", 'attachment; filename="glosa-datos.json"')
      .set("Cache-Control", "no-store")
      .type("application/json")
      .send(JSON.stringify(data, null, 2));
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (
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

    await AuthService.deleteAccount(req.userId, req.body);

    clearSessionCookies(res);

    res.status(204).send();
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
  uploadAvatar,
  getAvatar,
  removeAvatar,
  updatePreferences,
  completeOnboarding,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  exportData,
  deleteAccount,
};

export default AuthController;
