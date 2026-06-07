import { Router } from "express";
import { getUsers, blockUser, deleteUser } from "../controllers/users.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, requireRole(["admin", "super_admin"]), getUsers);
router.put("/:id/block", authenticateUser, requireRole(["admin", "super_admin"]), blockUser);
router.delete("/:id", authenticateUser, requireRole(["admin", "super_admin"]), deleteUser);

export default router;
