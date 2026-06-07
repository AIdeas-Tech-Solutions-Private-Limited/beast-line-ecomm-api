import { Router } from "express";
import {
  getReviews,
  getProductReviews,
  addReview,
  moderateReview,
  deleteReview,
} from "../controllers/reviews.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, getReviews);
router.get("/product/:productId", getProductReviews);
router.post("/", authenticateUser, addReview);
router.put("/:id/moderate", authenticateUser, requireRole(["admin", "super_admin"]), moderateReview);
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), deleteReview);

export default router;
