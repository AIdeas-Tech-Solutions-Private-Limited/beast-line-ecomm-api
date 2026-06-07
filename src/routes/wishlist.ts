import { Router } from "express";
import { getWishlist, toggleWishlist } from "../controllers/wishlist.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, getWishlist);
router.post("/toggle", authenticateUser, toggleWishlist);

export default router;
