import { Response, Request } from "express";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import { db } from "../db/index.js";
import { orders, orderItems, cartItems, products, users, coupons, checkoutSessions } from "../db/schema.js";
import { orderPlaceSchema, orderStatusUpdateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import Razorpay from "razorpay";
import crypto from "crypto";

const RazorpayConstructor = (Razorpay as any).default || Razorpay;

const razorpay = new RazorpayConstructor({
  key_id: (process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder").trim(),
  key_secret: (process.env.RAZORPAY_KEY_SECRET || "placeholder_secret").trim(),
});

// Helper to confirm order from saved checkout session
async function createOrderFromSession(razorpayOrderId: string, razorpayPaymentId: string) {
  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.razorpayOrderId, razorpayOrderId),
  });
  if (existingOrder) {
    console.log(`Order for Razorpay order ID ${razorpayOrderId} already exists.`);
    return existingOrder;
  }

  const session = await db.query.checkoutSessions.findFirst({
    where: eq(checkoutSessions.id, razorpayOrderId),
  });

  if (!session) {
    console.warn(`No checkout session found for Razorpay order ID ${razorpayOrderId}`);
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) {
    console.error(`User ${session.userId} not found for session ${session.id}`);
    return null;
  }

  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  await db.transaction(async (tx) => {
    const existingOrderTx = await tx.query.orders.findFirst({
      where: eq(orders.razorpayOrderId, razorpayOrderId),
    });
    if (existingOrderTx) return;

    await tx.insert(orders).values({
      id: orderId,
      customerId: session.userId,
      customerName: user.name,
      customerEmail: user.email,
      subtotal: session.subtotal,
      discount: session.discount,
      tax: session.tax,
      total: session.total,
      address: session.address as any,
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      timeline: [
        {
          status: "Pending",
          date: new Date().toLocaleString(),
          description: "Order placed. Payment received and verified.",
        },
      ],
      couponUsed: session.couponCode,
      razorpayOrderId,
      razorpayPaymentId,
    });

    const items = session.items as any[];
    for (const item of items) {
      await tx.insert(orderItems).values({
        orderId,
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        thumbnail: item.thumbnail,
      });

      const prod = await tx.query.products.findFirst({
        where: eq(products.id, item.productId),
      });
      if (prod) {
        await tx
          .update(products)
          .set({ stock: Math.max(0, prod.stock - item.quantity) })
          .where(eq(products.id, item.productId));
      }
    }

    await tx
      .update(users)
      .set({
        spending: user.spending + session.total,
        ordersCount: user.ordersCount + 1,
      })
      .where(eq(users.id, session.userId));

    await tx
      .delete(cartItems)
      .where(and(eq(cartItems.userId, session.userId), eq(cartItems.savedForLater, false)));

    await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, razorpayOrderId));
  });

  return await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
}

// Place Order
export const placeOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = orderPlaceSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const {
      address,
      paymentMethod,
      couponCode,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = parseResult.data;

    // Get active cart items
    const activeCart = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        selectedColor: cartItems.selectedColor,
        selectedSize: cartItems.selectedSize,
        product: products,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(eq(cartItems.userId, req.user.id), eq(cartItems.savedForLater, false)));

    if (activeCart.length === 0) {
      res.status(400).json({ error: "Cart is empty." });
      return;
    }

    // Check stock for all items
    for (const item of activeCart) {
      if (item.product.stock < item.quantity) {
        res.status(400).json({
          error: `Insufficient stock for ${item.product.name}. Available: ${item.product.stock}`,
        });
        return;
      }
    }

    const subtotal = activeCart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);

    // Process coupon
    let discount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await db.query.coupons.findFirst({
        where: eq(coupons.code, couponCode.toUpperCase()),
      });

      if (!appliedCoupon) {
        res.status(400).json({ error: "Invalid coupon code." });
        return;
      }

      if (subtotal < appliedCoupon.minPurchase) {
        res.status(400).json({
          error: `Minimum purchase of $${appliedCoupon.minPurchase} required for this coupon.`,
        });
        return;
      }

      if (appliedCoupon.type === "percentage") {
        discount = Math.round(subtotal * (appliedCoupon.value / 100));
      } else {
        discount = appliedCoupon.value;
      }
    }

    const tax = Math.round((subtotal - discount) * 0.12); // 12% standard tax
    const total = subtotal - discount + tax;

    // Handle Razorpay Payment Flow
    if (paymentMethod === "Razorpay") {
      if (!razorpay_payment_id) {
        // Step 1: Initialize Razorpay Order
        try {
          const rzpOrder = await razorpay.orders.create({
            amount: Math.round(total * 100), // in paisa (integer)
            currency: "INR",
            receipt: `rcpt_${Math.floor(1000 + Math.random() * 9000)}`,
          });

          // Save checkout session details
          const itemsToSave = activeCart.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            price: item.product.sellingPrice,
            quantity: item.quantity,
            color: item.selectedColor,
            size: item.selectedSize,
            thumbnail: item.product.thumbnail,
          }));

          await db.insert(checkoutSessions).values({
            id: rzpOrder.id,
            userId: req.user!.id,
            subtotal,
            discount,
            tax,
            total,
            address: address as any,
            couponCode: couponCode || null,
            items: itemsToSave,
          });

          res.status(200).json({
            success: true,
            requiresPayment: true,
            keyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
            razorpayOrder: {
              id: rzpOrder.id,
              amount: rzpOrder.amount,
              currency: rzpOrder.currency,
            },
          });
          return;
        } catch (rzpErr: any) {
          console.error("Razorpay Order Creation Failed:", rzpErr);
          try {
            fs.appendFileSync("place-order-errors.log", `${new Date().toISOString()} - RZP Init Error: ${rzpErr.stack || rzpErr.message}\n`);
          } catch (_) {}
          res.status(500).json({ error: "Razorpay order creation failed: " + rzpErr.message });
          return;
        }
      } else {
        // Step 2: Verify Razorpay Payment Signature
        if (!razorpay_order_id || !razorpay_payment_id) {
          res.status(400).json({ error: "Razorpay payment details are incomplete." });
          return;
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", (process.env.RAZORPAY_KEY_SECRET || "placeholder_secret").trim())
          .update(body.toString())
          .digest("hex");

        if (expectedSignature !== razorpay_signature) {
          res.status(400).json({ error: "Payment verification failed. Invalid signature." });
          return;
        }

        // Check if order already created (by webhook)
        let placedOrder = await db.query.orders.findFirst({
          where: eq(orders.razorpayOrderId, razorpay_order_id),
        });

        if (!placedOrder) {
          placedOrder = (await createOrderFromSession(razorpay_order_id, razorpay_payment_id)) || undefined;
        }

        if (!placedOrder) {
          res.status(400).json({ error: "Failed to place order or session expired." });
          return;
        }

        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, placedOrder.id));

        res.status(201).json({
          success: true,
          order: {
            ...placedOrder,
            items,
          },
        });
        return;
      }
    }

    // COD/Other Payment flow (non-Razorpay)
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create the order transactions
    await db.transaction(async (tx) => {
      // 1. Insert Order
      await tx.insert(orders).values({
        id: orderId,
        customerId: req.user!.id,
        customerName: req.user!.name,
        customerEmail: req.user!.email,
        subtotal,
        discount,
        tax,
        total,
        address,
        paymentMethod,
        paymentStatus: "Pending",
        status: "Pending",
        date: new Date().toISOString().split("T")[0],
        timeline: [
          {
            status: "Pending",
            date: new Date().toLocaleString(),
            description: "Order placed. Awaiting admin confirmation.",
          },
        ],
        couponUsed: couponCode || null,
      });

      // 2. Insert Order Items & Deduct Stock
      for (const item of activeCart) {
        await tx.insert(orderItems).values({
          orderId,
          productId: item.product.id,
          name: item.product.name,
          price: item.product.sellingPrice,
          quantity: item.quantity,
          color: item.selectedColor,
          size: item.selectedSize,
          thumbnail: item.product.thumbnail,
        });

        await tx
          .update(products)
          .set({ stock: item.product.stock - item.quantity })
          .where(eq(products.id, item.product.id));
      }

      // 3. Update User stats
      await tx
        .update(users)
        .set({
          spending: req.user!.spending + total,
          ordersCount: req.user!.ordersCount + 1,
        })
        .where(eq(users.id, req.user!.id));

      // 4. Clear active items from cart
      await tx
        .delete(cartItems)
        .where(and(eq(cartItems.userId, req.user!.id), eq(cartItems.savedForLater, false)));
    });

    // Fetch full order to return
    const placedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

    res.status(201).json({
      success: true,
      order: {
        ...placedOrder,
        items,
      },
    });
  } catch (error: any) {
    console.error("Place Order Error:", error);
    try {
      fs.appendFileSync("place-order-errors.log", `${new Date().toISOString()} - Place Order Error: ${error.stack || error.message}\n`);
    } catch (_) {}
    res.status(500).json({ error: error.message || "Internal server error." });
  }
};

// Get orders
export const getOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    let userOrders;
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      // Admin gets all orders
      userOrders = await db.select().from(orders).orderBy(orders.createdAt);
    } else {
      // Customer gets only their own
      userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, req.user.id))
        .orderBy(orders.createdAt);
    }

    // Attach items to each order
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        return {
          ...order,
          items,
        };
      })
    );

    res.status(200).json(ordersWithItems);
  } catch (error) {
    console.error("Get Orders Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update order status (Admin Only)
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = orderStatusUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { status, description } = parseResult.data;
    const { id } = req.params;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    const defaultDescs = {
      Pending: "Order has been registered.",
      Confirmed: "Order confirmed and verified.",
      Packed: "Order items have been packed.",
      Shipped: "Order shipped and in transit.",
      Delivered: "Order delivered safely.",
      Cancelled: "Order cancelled.",
    };

    const newTimelineEntry = {
      status,
      date: new Date().toLocaleString(),
      description: description || defaultDescs[status],
    };

    const updatedTimeline = [...order.timeline, newTimelineEntry];

    let pStatus = order.paymentStatus;
    if (status === "Delivered" && order.paymentMethod === "COD") {
      pStatus = "Paid";
    }

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status,
        paymentStatus: pStatus,
        timeline: updatedTimeline,
      })
      .where(eq(orders.id, id))
      .returning();

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

    res.status(200).json({
      success: true,
      order: {
        ...updatedOrder,
        items,
      },
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Razorpay Webhook Endpoint
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing signature header." });
      return;
    }

    const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "placeholder_secret").trim();
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      res.status(400).json({ error: "Invalid webhook signature." });
      return;
    }

    const { event, payload } = req.body;

    if (event === "payment.captured" || event === "order.paid") {
      const payment = payload.payment.entity;
      const razorpayOrderId = payment.order_id;
      const razorpayPaymentId = payment.id;

      if (razorpayOrderId) {
        console.log(`[Webhook] Processing payment verification for order ID: ${razorpayOrderId}`);
        await createOrderFromSession(razorpayOrderId, razorpayPaymentId);
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
};
