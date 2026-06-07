import { Router } from "express";
import { getCartItems, addToCart, updateCartItem, removeCartItem, clearCart } from "../controllers/cart.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, getCartItems);
router.post("/", authenticateUser, addToCart);
router.put("/:id", authenticateUser, updateCartItem);
router.delete("/:id", authenticateUser, removeCartItem);
router.delete("/", authenticateUser, clearCart);

export default router;
