import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

import authRouter from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import cartRouter from "./routes/cart.js";
import wishlistRouter from "./routes/wishlist.js";
import ordersRouter from "./routes/orders.js";
import couponsRouter from "./routes/coupons.js";
import bannersRouter from "./routes/banners.js";
import categoriesRouter from "./routes/categories.js";
import reviewsRouter from "./routes/reviews.js";
import returnsRouter from "./routes/returns.js";
import usersRouter from "./routes/users.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for credentials if needed
app.use(
  cors({
    origin: "*", // allow all origins for dev simplicity
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Serve uploaded files statically
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// Routes mapping
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/banners", bannersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/returns", returnsRouter);
app.use("/api/users", usersRouter);

// Root test endpoint
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Athletica Sportswear E-Commerce Backend API is active.",
    version: "1.0.0",
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error Handler:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// Test database connection and start server
db.execute(sql`SELECT 1`)
  .then(() => {
    console.log("Database connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server is running in dev mode on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("==========================================");
    console.error("Database connection failed:", err);
    console.error("==========================================");
    process.exit(1);
  });

