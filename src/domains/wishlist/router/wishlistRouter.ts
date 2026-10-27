import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import WishlistController from "../controller/WishlistController.js";

const wishlistRouter = Router();

wishlistRouter.use(authMiddleware);

wishlistRouter.post("/", handleCsrf, WishlistController.addToWishlist);

export default wishlistRouter;
