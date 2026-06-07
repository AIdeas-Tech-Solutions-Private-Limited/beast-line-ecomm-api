import { pgTable, text, boolean, integer, doublePrecision, timestamp, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";

// 1. Users Table
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "customer" | "super_admin">().notNull().default("customer"),
  blocked: boolean("blocked").notNull().default(false),
  spending: doublePrecision("spending").notNull().default(0),
  ordersCount: integer("orders_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 2. Categories Table
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    categoriesNameUnique: uniqueIndex("categories_name_unique").on(table.name),
    categoriesSlugUnique: uniqueIndex("categories_slug_unique").on(table.slug),
  })
);

// 3. Subcategories Table
export const subcategories = pgTable(
  "subcategories",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    subcategoriesCategoryNameUnique: uniqueIndex("subcategories_category_name_unique").on(
      table.categoryId,
      table.name
    ),
    subcategoriesCategorySlugUnique: uniqueIndex("subcategories_category_slug_unique").on(
      table.categoryId,
      table.slug
    ),
  })
);

// 4. Products Table
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  shortDescription: text("short_description").notNull(),
  mrp: doublePrecision("mrp").notNull(),
  sellingPrice: doublePrecision("selling_price").notNull(),
  discount: doublePrecision("discount").notNull(),
  tax: doublePrecision("tax").notNull(),
  sku: text("sku").notNull().unique(),
  stock: integer("stock").notNull(),
  minStock: integer("min_stock").notNull(),
  category: text("category").notNull(), // Men, Women, Kids, Accessories
  subCategory: text("sub_category").notNull(), // Shoes, T-Shirts, Jackets, Shorts, Hoodies
  gender: text("gender").$type<"Men" | "Women" | "Kids" | "Unisex">().notNull(),
  brand: text("brand").notNull(),
  sportType: text("sport_type").notNull(), // Running, Training, Football, Basketball, Cricket, Gym, All
  colors: jsonb("colors").$type<string[]>().notNull(),
  sizes: jsonb("sizes").$type<string[]>().notNull(),
  thumbnail: text("thumbnail").notNull(),
  gallery: jsonb("gallery").$type<string[]>().notNull(),
  metaTitle: text("meta_title").notNull(),
  metaDescription: text("meta_description").notNull(),
  keywords: text("keywords").notNull(),
  rating: doublePrecision("rating").notNull().default(5.0),
  featured: boolean("featured").notNull().default(false),
  bestSeller: boolean("best_seller").notNull().default(false),
  trending: boolean("trending").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 5. Cart Items Table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  selectedColor: text("selected_color").notNull(),
  selectedSize: text("selected_size").notNull(),
  savedForLater: boolean("saved_for_later").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 6. Wishlist Table
export const wishlist = pgTable("wishlist", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 7. Orders Table
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
  discount: doublePrecision("discount").notNull(),
  tax: doublePrecision("tax").notNull(),
  total: doublePrecision("total").notNull(),
  address: jsonb("address").$type<{
    name: string;
    mobile: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }>().notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").$type<"Pending" | "Paid" | "Refunded">().notNull(),
  status: text("status").$type<"Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Cancelled">().notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  timeline: jsonb("timeline").$type<{ status: string; date: string; description: string }[]>().notNull(),
  couponUsed: text("coupon_used"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 8. Order Items Table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  price: doublePrecision("price").notNull(),
  quantity: integer("quantity").notNull(),
  color: text("color").notNull(),
  size: text("size").notNull(),
  thumbnail: text("thumbnail").notNull(),
});

// 9. Coupons Table
export const coupons = pgTable("coupons", {
  code: text("code").primaryKey(),
  type: text("type").$type<"percentage" | "fixed">().notNull(),
  value: doublePrecision("value").notNull(),
  minPurchase: doublePrecision("min_purchase").notNull(),
  categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
  subcategoryIds: jsonb("subcategory_ids").$type<string[]>().notNull().default([]),
  brandNames: jsonb("brand_names").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 10. Banners Table
export const banners = pgTable("banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  image: text("image").notNull(),
  link: text("link"),
  type: jsonb("type").$type<string[]>().notNull().default([]),
  categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
  subcategoryIds: jsonb("subcategory_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 11. Reviews Table
export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  status: text("status").$type<"approved" | "pending" | "rejected">().notNull().default("pending"),
  rejectReason: text("reject_reason"),
  images: jsonb("images").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 12. Return Requests Table
export const returnRequests = pgTable("return_requests", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  thumbnail: text("thumbnail").notNull(),
  reason: text("reason").notNull(),
  evidenceImage: text("evidence_image"),
  status: text("status").$type<"Pending" | "Approved" | "Rejected">().notNull().default("Pending"),
  date: text("date").notNull(),
  customerName: text("customer_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 13. Checkout Sessions Table (for Razorpay Webhook backup)
export const checkoutSessions = pgTable("checkout_sessions", {
  id: text("id").primaryKey(), // Razorpay order ID (e.g. order_XXXX)
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subtotal: doublePrecision("subtotal").notNull(),
  discount: doublePrecision("discount").notNull(),
  tax: doublePrecision("tax").notNull(),
  total: doublePrecision("total").notNull(),
  address: jsonb("address").$type<{
    name: string;
    mobile: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }>().notNull(),
  couponCode: text("coupon_code"),
  items: jsonb("items").notNull(), // List of items being purchased
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

