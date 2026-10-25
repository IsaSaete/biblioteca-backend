import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import StatsController from "../controller/StatsController.js";

const statsRouter = Router();

statsRouter.use(authMiddleware);

statsRouter.get("/", StatsController.getStats);

export default statsRouter;
