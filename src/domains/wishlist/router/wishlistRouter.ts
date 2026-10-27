import { Router } from "express";
import authMiddleware from "../../../middleware/authMiddleware.js";
import handleCsrf from "../../../middleware/handleCsrf.js";
import WishlistController from "../controller/WishlistController.js";

const wishlistRouter = Router();

wishlistRouter.use(authMiddleware);

wishlistRouter.get("/", WishlistController.listWishlist);
wishlistRouter.post("/", handleCsrf, WishlistController.addToWishlist);
wishlistRouter.patch("/:id", handleCsrf, WishlistController.updateWishlistItem);
wishlistRouter.delete(
  "/:id",
  handleCsrf,
  WishlistController.removeFromWishlist,
);

export default wishlistRouter;
