import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import AuthController from "../controller/AuthController.js";
import limitLoginRequests from "../middleware/limitLoginRequests.js";
import limitRegisterRequests from "../middleware/limitRegisterRequests.js";

const authRouter = Router();

authRouter.post("/register", limitRegisterRequests, AuthController.register);
authRouter.get("/verify-email", AuthController.verifyEmail);
authRouter.post("/login", limitLoginRequests, AuthController.login);
authRouter.get("/me", authMiddleware, AuthController.me);
authRouter.post("/refresh", handleCsrf, AuthController.refresh);
authRouter.post("/logout", handleCsrf, AuthController.logout);

export default authRouter;
