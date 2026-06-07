import { Router } from "express";
import { createReturnRequest, getReturnRequests, moderateReturnRequest } from "../controllers/returns.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticateUser, createReturnRequest);
router.get("/", authenticateUser, getReturnRequests);
router.put("/:id/moderate", authenticateUser, requireRole(["admin", "super_admin"]), moderateReturnRequest);

export default router;
