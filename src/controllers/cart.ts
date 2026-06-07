import { Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { cartItems, products } from "../db/schema.js";
import { cartItemAddSchema, cartItemUpdateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Get Cart Items
export const getCartItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        selectedColor: cartItems.selectedColor,
        selectedSize: cartItems.selectedSize,
        savedForLater: cartItems.savedForLater,
        product: products,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, req.user.id));

    res.status(200).json(items);
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Add to Cart
export const addToCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = cartItemAddSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { productId, quantity, selectedColor, selectedSize, savedForLater } = parseResult.data;

    // Check if product exists
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    // Check if item already exists in user's cart
    const existingItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.userId, req.user.id),
        eq(cartItems.productId, productId),
        eq(cartItems.selectedColor, selectedColor),
        eq(cartItems.selectedSize, selectedSize),
        eq(cartItems.savedForLater, savedForLater)
      ),
    });

    if (existingItem) {
      // Update quantity
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + quantity })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      res.status(200).json({ success: true, item: updatedItem });
      return;
    }

    // Insert new item
    const [newItem] = await db
      .insert(cartItems)
      .values({
        userId: req.user.id,
        productId,
        quantity,
        selectedColor,
        selectedSize,
        savedForLater,
      })
      .returning();

    res.status(201).json({ success: true, item: newItem });
  } catch (error) {
    console.error("Add to Cart Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update Cart Item (qty / save for later toggle)
export const updateCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = cartItemUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { id } = req.params;
    const cartItemId = parseInt(id);
    if (isNaN(cartItemId)) {
      res.status(400).json({ error: "Invalid cart item ID." });
      return;
    }

    // Check if item belongs to user
    const item = await db.query.cartItems.findFirst({
      where: and(eq(cartItems.id, cartItemId), eq(cartItems.userId, req.user.id)),
    });

    if (!item) {
      res.status(404).json({ error: "Cart item not found." });
      return;
    }

    const [updatedItem] = await db
      .update(cartItems)
      .set(parseResult.data)
      .where(eq(cartItems.id, cartItemId))
      .returning();

    res.status(200).json({ success: true, item: updatedItem });
  } catch (error) {
    console.error("Update Cart Item Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Remove Cart Item
export const removeCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const { id } = req.params;
    const cartItemId = parseInt(id);
    if (isNaN(cartItemId)) {
      res.status(400).json({ error: "Invalid cart item ID." });
      return;
    }

    const [deleted] = await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.userId, req.user.id)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Cart item not found." });
      return;
    }

    res.status(200).json({ success: true, message: "Item removed from cart." });
  } catch (error) {
    console.error("Remove Cart Item Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Clear Cart
export const clearCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    await db.delete(cartItems).where(eq(cartItems.userId, req.user.id));
    res.status(200).json({ success: true, message: "Cart cleared." });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
