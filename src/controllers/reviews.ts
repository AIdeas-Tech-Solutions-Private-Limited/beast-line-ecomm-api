import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { reviews, products } from "../db/schema.js";
import { reviewCreateSchema, reviewModerateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Get reviews (Admin sees all, customers see approved only)
export const getReviews = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin";

    const list = isAdmin
      ? await db.select().from(reviews).orderBy(reviews.createdAt)
      : await db
          .select()
          .from(reviews)
          .where(eq(reviews.status, "approved"))
          .orderBy(reviews.createdAt);

    res.status(200).json(list);
  } catch (error) {
    console.error("Get All Reviews Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get approved reviews for product
export const getProductReviews = async (req: any, res: Response): Promise<void> => {
  try {
    const list = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, req.params.productId), eq(reviews.status, "approved")))
      .orderBy(reviews.createdAt);

    res.status(200).json(list);
  } catch (error) {
    console.error("Get Product Reviews Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Add Review (Authenticated User)
export const addReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = reviewCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { productId, rating, comment, images } = parseResult.data;

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    const id = `rev-${Date.now()}`;

    const [newReview] = await db
      .insert(reviews)
      .values({
        id,
        productId,
        userId: req.user.id,
        userName: req.user.name,
        rating,
        comment,
        date: new Date().toISOString().split("T")[0],
        status: "pending",
        images: images || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Review submitted successfully. Awaiting administrator moderation.",
      review: newReview,
    });
  } catch (error) {
    console.error("Submit Review Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Moderate Review (Admin Only)
export const moderateReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = reviewModerateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { status, rejectReason } = parseResult.data;
    const { id } = req.params;

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, id),
    });

    if (!review) {
      res.status(404).json({ error: "Review not found." });
      return;
    }

    // Update review status and reject reason
    const [updatedReview] = await db
      .update(reviews)
      .set({
        status,
        rejectReason: status === "rejected" ? (rejectReason ?? null) : null,
      })
      .where(eq(reviews.id, id))
      .returning();

    // Recalculate average rating of product if approved
    if (status === "approved") {
      const prodReviews = await db
        .select()
        .from(reviews)
        .where(and(eq(reviews.productId, review.productId), eq(reviews.status, "approved")));

      const avg =
        prodReviews.reduce((sum, item) => sum + item.rating, 0) / (prodReviews.length || 1);

      await db
        .update(products)
        .set({ rating: parseFloat(avg.toFixed(1)) })
        .where(eq(products.id, review.productId));
    }

    res.status(200).json({ success: true, review: updatedReview });
  } catch (error) {
    console.error("Moderate Review Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete Review (Admin Only)
export const deleteReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [deleted] = await db.delete(reviews).where(eq(reviews.id, id)).returning();

    if (!deleted) {
      res.status(404).json({ error: "Review not found." });
      return;
    }

    // Recalculate product rating
    const prodReviews = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, deleted.productId), eq(reviews.status, "approved")));

    const avg =
      prodReviews.reduce((sum, item) => sum + item.rating, 0) / (prodReviews.length || 1);

    await db
      .update(products)
      .set({ rating: parseFloat(avg.toFixed(1)) })
      .where(eq(products.id, deleted.productId));

    res.status(200).json({ success: true, message: "Review deleted successfully." });
  } catch (error) {
    console.error("Delete Review Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
