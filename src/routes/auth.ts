import { Router } from "express";
import { register, login, getProfile, updateProfile } from "../controllers/auth.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authenticateUser, getProfile);
router.put("/profile", authenticateUser, updateProfile);

export default router;
