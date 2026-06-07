import { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { banners } from "../db/schema.js";
import { bannerCreateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Get all banners
export const getBanners = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const list = await db.select().from(banners).orderBy(banners.createdAt);
    res.status(200).json(list);
  } catch (error) {
    console.error("Get Banners Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Create Banner (Admin Only)
export const createBanner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Build body from multer fields
    const body: any = { ...req.body };

    // Parse JSON string fields from FormData
    if (typeof body.type === "string") {
      try { body.type = JSON.parse(body.type); } catch { body.type = []; }
    }
    if (typeof body.categoryIds === "string") {
      try { body.categoryIds = JSON.parse(body.categoryIds); } catch { body.categoryIds = []; }
    }
    if (typeof body.subcategoryIds === "string") {
      try { body.subcategoryIds = JSON.parse(body.subcategoryIds); } catch { body.subcategoryIds = []; }
    }

    // If a file was uploaded, use its URL path
    if (req.file) {
      body.image = `/uploads/${req.file.filename}`;
    }

    const parseResult = bannerCreateSchema.safeParse(body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const id = `banner-${Date.now()}`;

    // Auto-generate link from category/subcategory selections
    const { categoryIds, subcategoryIds } = parseResult.data;
    let link = parseResult.data.link;
    if (!link && categoryIds.length > 0) {
      link = `/products?categories=${categoryIds.join(",")}`;
    }

    const [newBanner] = await db
      .insert(banners)
      .values({
        id,
        title: parseResult.data.title,
        subtitle: parseResult.data.subtitle,
        image: parseResult.data.image,
        link,
        type: parseResult.data.type,
        categoryIds: categoryIds ?? [],
        subcategoryIds: subcategoryIds ?? [],
      })
      .returning();

    res.status(201).json(newBanner);
  } catch (error) {
    console.error("Create Banner Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete Banner (Admin Only)
export const deleteBanner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [deleted] = await db.delete(banners).where(eq(banners.id, id)).returning();

    if (!deleted) {
      res.status(404).json({ error: "Banner not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Banner deleted successfully." });
  } catch (error) {
    console.error("Delete Banner Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
