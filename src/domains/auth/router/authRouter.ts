import { Router } from "express";
import AuthController from "../controller/AuthController.js";

const authRouter = Router();

authRouter.post("/register", AuthController.register);
authRouter.get("/verify-email", AuthController.verifyEmail);

export default authRouter;
