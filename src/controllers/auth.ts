import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { registerSchema, loginSchema, profileUpdateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

const JWT_SECRET = process.env.JWT_SECRATE || "tyefhw5-krje45-3mdfn";

// Register Route
export const register = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { name, email, mobile, password } = parseResult.data;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      res.status(400).json({ error: "Email already exists." });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}`;

    // Insert user
    await db.insert(users).values({
      id: userId,
      name,
      email: email.toLowerCase(),
      mobile,
      passwordHash,
      role: "customer",
      blocked: false,
      spending: 0,
      ordersCount: 0,
    });

    // Generate JWT
    const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        name,
        email: email.toLowerCase(),
        mobile,
        role: "customer",
        blocked: false,
        spending: 0,
        ordersCount: 0,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Login Route
export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { email, password } = parseResult.data;

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      res.status(400).json({ error: "Invalid email or password." });
      return;
    }

    if (user.blocked) {
      res.status(403).json({ error: "This account has been blocked by administrator." });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ error: "Invalid email or password." });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        blocked: user.blocked,
        spending: user.spending,
        ordersCount: user.ordersCount,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Profile Route
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  res.status(200).json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    mobile: req.user.mobile,
    role: req.user.role,
    blocked: req.user.blocked,
    spending: req.user.spending,
    ordersCount: req.user.ordersCount,
  });
};

// Update Profile Route
export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = profileUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { name, mobile } = parseResult.data;

    await db.update(users)
      .set({ name, mobile })
      .where(eq(users.id, req.user.id));

    res.status(200).json({
      success: true,
      user: {
        ...req.user,
        name,
        mobile,
      },
    });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
