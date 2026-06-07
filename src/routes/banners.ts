import { Router } from "express";
import { getBanners, createBanner, deleteBanner } from "../controllers/banners.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", getBanners);
router.post(
  "/",
  authenticateUser,
  requireRole(["admin", "super_admin"]),
  upload.single("image"),
  createBanner
);
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), deleteBanner);

export default router;
