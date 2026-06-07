import { Response } from "express";
import { eq, inArray, and, like, or, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";
import { productCreateSchema, productUpdateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { z } from "zod";

// Helper: Generate SKU from subCategory, year, and sequential count
// Format: ABC-YYYY-NN (e.g. SHO-2026-01, TSH-2026-03)
function getSubCategoryPrefix(subCategory: string): string {
  const map: Record<string, string> = {
    shoes: "SHO",
    sneakers: "SNK",
    boots: "BOT",
    sandals: "SND",
    "t-shirts": "TSH",
    tshirts: "TSH",
    shirts: "SHT",
    jackets: "JKT",
    shorts: "SRT",
    hoodies: "HOD",
    trackpants: "TRP",
    "track pants": "TRP",
    joggers: "JOG",
    leggings: "LEG",
    socks: "SOC",
    caps: "CAP",
    hats: "HAT",
    bags: "BAG",
    backpacks: "BAK",
    gloves: "GLV",
    accessories: "ACC",
    equipment: "EQP",
    balls: "BAL",
  };
  const key = subCategory.toLowerCase().trim();
  if (map[key]) return map[key];
  // Fallback: first 3 letters uppercase
  return subCategory.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
}

async function generateSKU(subCategory: string): Promise<string> {
  const prefix = getSubCategoryPrefix(subCategory);
  const year = new Date().getFullYear();
  // Count existing products whose SKU starts with PREFIX-YEAR
  const pattern = `${prefix}-${year}-%`;
  const result = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(products)
    .where(like(products.sku, pattern));
  const count = result[0]?.count ?? 0;
  const seq = String(count + 1).padStart(2, "0");
  return `${prefix}-${year}-${seq}`;
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()),
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string()),
  updates: productUpdateSchema,
});

// Get all products with filtering
export const getProducts = async (req: any, res: Response): Promise<void> => {
  try {
    const { category, gender, sportType, bestSeller, featured, trending, q } = req.query;

    const conditions = [];

    if (category) {
      conditions.push(eq(products.category, category as string));
    }
    if (gender) {
      conditions.push(eq(products.gender, gender as any));
    }
    if (sportType) {
      conditions.push(eq(products.sportType, sportType as string));
    }
    if (bestSeller === "true") {
      conditions.push(eq(products.bestSeller, true));
    }
    if (featured === "true") {
      conditions.push(eq(products.featured, true));
    }
    if (trending === "true") {
      conditions.push(eq(products.trending, true));
    }
    if (q) {
      conditions.push(
        or(
          like(products.name, `%${q}%`),
          like(products.description, `%${q}%`),
          like(products.brand, `%${q}%`),
          like(products.category, `%${q}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const allProducts = await db.select().from(products).where(whereClause);

    res.status(200).json(allProducts);
  } catch (error) {
    console.error("Fetch Products Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get distinct brands for a given category + subcategory
export const getBrands = async (req: any, res: Response): Promise<void> => {
  try {
    const { category, subcategory } = req.query;
    const conditions = [];

    if (category) {
      conditions.push(eq(products.category, category as string));
    }
    if (subcategory) {
      conditions.push(eq(products.subCategory, subcategory as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({ brand: products.brand })
      .from(products)
      .where(whereClause);

    const brands = [...new Set(rows.map((r) => r.brand))].sort();
    res.status(200).json(brands);
  } catch (error) {
    console.error("Fetch Brands Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get product by slug
export const getProductBySlug = async (req: any, res: Response): Promise<void> => {
  try {
    const product = await db.query.products.findFirst({
      where: eq(products.slug, req.params.slug),
    });

    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Fetch Product Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Create product (Admin Only)
export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = productCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error("Product Creation Validation Error:", parseResult.error.format());
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const slug = parseResult.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const id = `prod-${Date.now()}`;

    // Auto-generate SKU: PREFIX-YEAR-SEQ (e.g. SHO-2026-01)
    const sku = await generateSKU(parseResult.data.subCategory);

    const [newProduct] = await db.insert(products).values({
      ...parseResult.data,
      id,
      slug,
      sku,
      rating: 5.0,
    }).returning();

    res.status(201).json(newProduct);
  } catch (error: any) {
    console.error("Create Product Error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Product with this SKU or Name already exists." });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update product (Admin Only)
export const updateProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = productUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const updates: any = { ...parseResult.data };
    if (updates.name) {
      updates.slug = updates.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    const [updatedProduct] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, req.params.id))
      .returning();

    if (!updatedProduct) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete product (Admin Only)
export const deleteProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [deletedProduct] = await db
      .delete(products)
      .where(eq(products.id, req.params.id))
      .returning();

    if (!deletedProduct) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Bulk Delete Products (Admin Only)
export const bulkDeleteProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = bulkDeleteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid array of IDs" });
      return;
    }

    const { ids } = parseResult.data;

    if (ids.length === 0) {
      res.status(400).json({ error: "No product IDs specified." });
      return;
    }

    await db.delete(products).where(inArray(products.id, ids));

    res.status(200).json({ success: true, message: `${ids.length} products deleted.` });
  } catch (error) {
    console.error("Bulk Delete Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Bulk Update Products (Admin Only)
export const bulkUpdateProducts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = bulkUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { ids, updates } = parseResult.data;

    if (ids.length === 0) {
      res.status(400).json({ error: "No product IDs specified." });
      return;
    }

    await db
      .update(products)
      .set(updates as any)
      .where(inArray(products.id, ids));

    res.status(200).json({ success: true, message: `${ids.length} products updated.` });
  } catch (error) {
    console.error("Bulk Update Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
