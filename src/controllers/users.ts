import { Response } from "express";
import { eq, ne } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { userStatusUpdateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Get all users (Admin Only)
export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Return all users except passwords, sorted by createdAt
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        role: users.role,
        blocked: users.blocked,
        spending: users.spending,
        ordersCount: users.ordersCount,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(ne(users.role, "super_admin")) // Hide super admins if any
      .orderBy(users.createdAt);

    res.status(200).json(allUsers);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Block/Unblock user (Admin Only)
export const blockUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = userStatusUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { blocked } = parseResult.data;
    const { id } = req.params;

    const userToBlock = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!userToBlock) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (userToBlock.role === "super_admin" || userToBlock.role === "admin") {
      res.status(400).json({ error: "Cannot block administrative users." });
      return;
    }

    const [updatedUser] = await db
      .update(users)
      .set({ blocked })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        blocked: users.blocked,
      });

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Block User Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete user (Admin Only)
export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const userToDelete = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!userToDelete) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    // Prevent deleting admin or super_admin accounts
    if (userToDelete.role === "super_admin" || userToDelete.role === "admin") {
      res.status(400).json({ error: "Cannot delete administrative accounts." });
      return;
    }

    await db.delete(users).where(eq(users.id, id));

    res.status(200).json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
