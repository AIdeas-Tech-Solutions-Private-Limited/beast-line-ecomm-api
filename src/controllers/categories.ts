import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories, subcategories } from "../db/schema.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { z } from "zod";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const categorySchema = z.object({
  name: z.string().min(1).max(120),
});

const subcategorySchema = z.object({
  name: z.string().min(1).max(120),
});

// Get categories with nested subcategories
export const getCategories = async (req: any, res: Response): Promise<void> => {
  try {
    const categoryRows = await db.select().from(categories);
    const subcategoryRows = await db.select().from(subcategories);

    const response = categoryRows.map((category) => ({
      ...category,
      subcategories: subcategoryRows.filter((sub) => sub.categoryId === category.id),
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Fetch Categories Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Create category (Admin Only)
export const createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const name = parseResult.data.name.trim();
    const slug = slugify(name);
    const id = `cat-${Date.now()}`;

    const exists = await db
      .select()
      .from(categories)
      .where(and(eq(categories.name, name)));

    if (exists.length > 0) {
      res.status(400).json({ error: "Category already exists." });
      return;
    }

    const [newCategory] = await db
      .insert(categories)
      .values({ id, name, slug })
      .returning();

    res.status(201).json(newCategory);
  } catch (error: any) {
    console.error("Create Category Error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Category already exists." });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update category (Admin Only)
export const updateCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const name = parseResult.data.name.trim();
    const slug = slugify(name);

    const [updatedCategory] = await db
      .update(categories)
      .set({ name, slug })
      .where(eq(categories.id, req.params.id))
      .returning();

    if (!updatedCategory) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.status(200).json(updatedCategory);
  } catch (error: any) {
    console.error("Update Category Error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Category already exists." });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete category (Admin Only)
export const deleteCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [deletedCategory] = await db
      .delete(categories)
      .where(eq(categories.id, req.params.id))
      .returning();

    if (!deletedCategory) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Category deleted successfully." });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Create subcategory (Admin Only)
export const createSubcategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = subcategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const parent = await db
      .select()
      .from(categories)
      .where(eq(categories.id, req.params.categoryId))
      .limit(1);

    if (parent.length === 0) {
      res.status(404).json({ error: "Category not found." });
      return;
    }

    const name = parseResult.data.name.trim();
    const slug = slugify(name);
    const id = `subcat-${Date.now()}`;

    const [newSubcategory] = await db
      .insert(subcategories)
      .values({
        id,
        categoryId: req.params.categoryId,
        name,
        slug,
      })
      .returning();

    res.status(201).json(newSubcategory);
  } catch (error: any) {
    console.error("Create Subcategory Error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Subcategory already exists in this category." });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update subcategory (Admin Only)
export const updateSubcategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = subcategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const name = parseResult.data.name.trim();
    const slug = slugify(name);

    const [updatedSubcategory] = await db
      .update(subcategories)
      .set({ name, slug })
      .where(
        and(
          eq(subcategories.id, req.params.subcategoryId),
          eq(subcategories.categoryId, req.params.categoryId)
        )
      )
      .returning();

    if (!updatedSubcategory) {
      res.status(404).json({ error: "Subcategory not found." });
      return;
    }

    res.status(200).json(updatedSubcategory);
  } catch (error: any) {
    console.error("Update Subcategory Error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Subcategory already exists in this category." });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete subcategory (Admin Only)
export const deleteSubcategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [deletedSubcategory] = await db
      .delete(subcategories)
      .where(
        and(
          eq(subcategories.id, req.params.subcategoryId),
          eq(subcategories.categoryId, req.params.categoryId)
        )
      )
      .returning();

    if (!deletedSubcategory) {
      res.status(404).json({ error: "Subcategory not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Subcategory deleted successfully." });
  } catch (error) {
    console.error("Delete Subcategory Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
