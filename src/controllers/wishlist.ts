import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { wishlist, products } from "../db/schema.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { z } from "zod";

const toggleWishlistSchema = z.object({
  productId: z.string(),
});

// Get wishlist
export const getWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const list = await db
      .select({
        id: wishlist.id,
        productId: wishlist.productId,
        product: products,
      })
      .from(wishlist)
      .innerJoin(products, eq(wishlist.productId, products.id))
      .where(eq(wishlist.userId, req.user.id));

    res.status(200).json(list);
  } catch (error) {
    console.error("Get Wishlist Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Toggle wishlist item
export const toggleWishlist = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = toggleWishlistSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Product ID is required." });
      return;
    }

    const { productId } = parseResult.data;

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    // Check if in wishlist already
    const existing = await db.query.wishlist.findFirst({
      where: and(eq(wishlist.userId, req.user.id), eq(wishlist.productId, productId)),
    });

    if (existing) {
      // Remove
      await db.delete(wishlist).where(eq(wishlist.id, existing.id));
      res.status(200).json({ success: true, action: "removed", message: "Removed from wishlist." });
    } else {
      // Add
      const [newWish] = await db
        .insert(wishlist)
        .values({
          userId: req.user.id,
          productId,
        })
        .returning();
      res.status(201).json({ success: true, action: "added", item: newWish });
    }
  } catch (error) {
    console.error("Toggle Wishlist Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
