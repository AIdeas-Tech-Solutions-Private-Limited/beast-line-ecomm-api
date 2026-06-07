import { Router } from "express";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/categories.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

// Category Routes
router.get("/", getCategories);
router.post("/", authenticateUser, requireRole(["admin", "super_admin"]), createCategory);
router.put("/:id", authenticateUser, requireRole(["admin", "super_admin"]), updateCategory);
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), deleteCategory);

// Subcategory Routes
router.post("/:categoryId/subcategories", authenticateUser, requireRole(["admin", "super_admin"]), createSubcategory);
router.put("/:categoryId/subcategories/:subcategoryId", authenticateUser, requireRole(["admin", "super_admin"]), updateSubcategory);
router.delete("/:categoryId/subcategories/:subcategoryId", authenticateUser, requireRole(["admin", "super_admin"]), deleteSubcategory);

export default router;
