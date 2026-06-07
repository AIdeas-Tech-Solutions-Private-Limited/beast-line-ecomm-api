import { Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { returnRequests, orders, products } from "../db/schema.js";
import { returnRequestCreateSchema, returnRequestModerateSchema } from "../validators/index.js";
import { AuthenticatedRequest } from "../middleware/auth.js";

// Create Return Request
export const createReturnRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const parseResult = returnRequestCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { orderId, productId, productName, thumbnail, reason, evidenceImage } = parseResult.data;

    // Check order and ownership
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    if (order.customerId !== req.user.id) {
      res.status(403).json({ error: "Access denied. Order does not belong to you." });
      return;
    }

    const id = `ret-${Date.now()}`;

    // Transaction
    await db.transaction(async (tx) => {
      // 1. Create return request
      await tx.insert(returnRequests).values({
        id,
        orderId,
        productId,
        productName,
        thumbnail,
        reason,
        evidenceImage: evidenceImage || null,
        status: "Pending",
        date: new Date().toISOString().split("T")[0],
        customerName: req.user!.name,
      });

      // 2. Append timeline entry to order
      const timelineEntry = {
        status: order.status,
        date: new Date().toLocaleString(),
        description: `Return requested for item: ${productName}. Reason: ${reason}`,
      };

      await tx
        .update(orders)
        .set({
          timeline: [...order.timeline, timelineEntry],
        })
        .where(eq(orders.id, orderId));
    });

    const newReturn = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, id),
    });

    res.status(201).json({ success: true, returnRequest: newReturn });
  } catch (error) {
    console.error("Create Return Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get Return Requests
export const getReturnRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    let list;
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      // Admin gets all return requests
      list = await db.select().from(returnRequests).orderBy(returnRequests.createdAt);
    } else {
      // Customer gets only their own returns
      list = await db
        .select({
          returnRequest: returnRequests,
        })
        .from(returnRequests)
        .innerJoin(orders, eq(returnRequests.orderId, orders.id))
        .where(eq(orders.customerId, req.user.id))
        .orderBy(returnRequests.createdAt);

      list = list.map((item) => item.returnRequest);
    }

    res.status(200).json(list);
  } catch (error) {
    console.error("Get Returns Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Moderate Return Request (Admin Only)
export const moderateReturnRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parseResult = returnRequestModerateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0].message });
      return;
    }

    const { status } = parseResult.data;
    const { id } = req.params;

    const ret = await db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, id),
    });

    if (!ret) {
      res.status(404).json({ error: "Return request not found." });
      return;
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, ret.orderId),
    });

    if (!order) {
      res.status(404).json({ error: "Associated order not found." });
      return;
    }

    let updatedRet;

    await db.transaction(async (tx) => {
      // 1. Update status
      [updatedRet] = await tx
        .update(returnRequests)
        .set({ status })
        .where(eq(returnRequests.id, id))
        .returning();

      // 2. Update order timeline and potentially paymentStatus / restock
      const timelineEntries = [...order.timeline];
      if (status === "Approved") {
        timelineEntries.push({
          status: order.status,
          date: new Date().toLocaleString(),
          description: `Return request approved for: ${ret.productName}. Refund processed.`,
        });

        await tx
          .update(orders)
          .set({
            paymentStatus: "Refunded",
            timeline: timelineEntries,
          })
          .where(eq(orders.id, ret.orderId));

        // Restock product by 1
        const prod = await tx.query.products.findFirst({
          where: eq(products.id, ret.productId),
        });
        if (prod) {
          await tx
            .update(products)
            .set({ stock: prod.stock + 1 })
            .where(eq(products.id, ret.productId));
        }
      } else if (status === "Rejected") {
        timelineEntries.push({
          status: order.status,
          date: new Date().toLocaleString(),
          description: `Return request rejected for: ${ret.productName}.`,
        });

        await tx
          .update(orders)
          .set({
            timeline: timelineEntries,
          })
          .where(eq(orders.id, ret.orderId));
      }
    });

    res.status(200).json({ success: true, returnRequest: updatedRet });
  } catch (error) {
    console.error("Moderate Return Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
