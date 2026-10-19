import { Router } from "express";
import AuthController from "../controller/AuthController.js";
import limitRegisterRequests from "../middleware/limitRegisterRequests.js";

const authRouter = Router();

authRouter.post("/register", limitRegisterRequests, AuthController.register);
authRouter.get("/verify-email", AuthController.verifyEmail);

export default authRouter;
