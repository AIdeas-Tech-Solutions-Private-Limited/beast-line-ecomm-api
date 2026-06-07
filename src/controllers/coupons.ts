import { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { coupons } from "../db/schema.js";
import { couponCreateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Get all coupons
export const getCoupons = async (req: any, res: Response): Promise<void> => {
  try {
    const list = await db.select().from(coupons).orderBy(coupons.createdAt);
    res.status(200).json(list);
  } catch (error) {
    console.error("Get Coupons Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Create Coupon (Admin Only)
export const createCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = couponCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { code, type, value, minPurchase, categoryIds, subcategoryIds, brandNames } = parseResult.data;

    // Check if exists
    const existing = await db.query.coupons.findFirst({
      where: eq(coupons.code, code.toUpperCase()),
    });

    if (existing) {
      res.status(400).json({ error: "Coupon code already exists." });
      return;
    }

    const [newCoupon] = await db
      .insert(coupons)
      .values({
        code: code.toUpperCase(),
        type,
        value,
        minPurchase,
        categoryIds: categoryIds ?? [],
        subcategoryIds: subcategoryIds ?? [],
        brandNames: brandNames ?? [],
      })
      .returning();

    res.status(201).json(newCoupon);
  } catch (error) {
    console.error("Create Coupon Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete Coupon (Admin Only)
export const deleteCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const [deleted] = await db
      .delete(coupons)
      .where(eq(coupons.code, code.toUpperCase()))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Coupon not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Delete Coupon Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
