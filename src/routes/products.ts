import { Router } from "express";
import {
  getProducts,
  getBrands,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  bulkUpdateProducts,
} from "../controllers/products.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", getProducts);
router.get("/brands", getBrands);
router.get("/:slug", getProductBySlug);
router.post("/", authenticateUser, requireRole(["admin", "super_admin"]), createProduct);
router.put("/:id", authenticateUser, requireRole(["admin", "super_admin"]), updateProduct);
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), deleteProduct);
router.post("/bulk-delete", authenticateUser, requireRole(["admin", "super_admin"]), bulkDeleteProducts);
router.post("/bulk-update", authenticateUser, requireRole(["admin", "super_admin"]), bulkUpdateProducts);

export default router;
