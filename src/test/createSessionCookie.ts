import { Types } from "mongoose";
import { createAccessToken } from "../utils/tokens.js";

export const CSRF_TOKEN = "csrf-value";

// Sesión de un usuario ficticio para tests de endpoints protegidos que no
// necesitan pasar por el registro: authMiddleware solo verifica el token.
const createSessionCookie = (
  userId: string = new Types.ObjectId().toString(),
): { userId: string; cookie: string } => ({
  userId,
  cookie: `accessToken=${createAccessToken({ userId })}; csrfToken=${CSRF_TOKEN}`,
});

export default createSessionCookie;
