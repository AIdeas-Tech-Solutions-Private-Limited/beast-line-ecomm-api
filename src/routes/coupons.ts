import { Router } from "express";
import { getCoupons, createCoupon, deleteCoupon } from "../controllers/coupons.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", getCoupons);
router.post("/", authenticateUser, requireRole(["admin", "super_admin"]), createCoupon);
router.delete("/:code", authenticateUser, requireRole(["admin", "super_admin"]), deleteCoupon);

export default router;
