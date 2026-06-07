import { Router } from "express";
import { placeOrder, getOrders, updateOrderStatus, razorpayWebhook } from "../controllers/orders.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticateUser, placeOrder);
router.get("/", authenticateUser, getOrders);
router.put("/:id/status", authenticateUser, requireRole(["admin", "super_admin"]), updateOrderStatus);
router.post("/webhook", razorpayWebhook);

export default router;
