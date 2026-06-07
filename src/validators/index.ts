import { z } from "zod";

// User Register Validator
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().min(8, "Mobile number must be at least 8 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// User Login Validator
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Profile Update Validator
export const profileUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().min(8, "Mobile number must be at least 8 digits"),
});

// Product Create/Update Validator
export const productCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(1),
  shortDescription: z.string().min(1),
  mrp: z.number().positive(),
  sellingPrice: z.number().positive(),
  discount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  sku: z.string().min(2).optional(),
  stock: z.number().int().nonnegative(),
  minStock: z.number().int().nonnegative(),
  category: z.string(),
  subCategory: z.string(),
  gender: z.enum(["Men", "Women", "Kids", "Unisex"]),
  brand: z.string(),
  sportType: z.string(),
  colors: z.array(z.string()).nonempty(),
  sizes: z.array(z.string()).nonempty(),
  thumbnail: z.string().min(1),
  gallery: z.array(z.string().min(1)),
  metaTitle: z.string(),
  metaDescription: z.string(),
  keywords: z.string(),
  featured: z.boolean().optional().default(false),
  bestSeller: z.boolean().optional().default(false),
  trending: z.boolean().optional().default(false),
});

export const productUpdateSchema = productCreateSchema.partial();

// Cart Validators
export const cartItemAddSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  selectedColor: z.string(),
  selectedSize: z.string(),
  savedForLater: z.boolean().optional().default(false),
});

export const cartItemUpdateSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  savedForLater: z.boolean().optional(),
});

// Order Validators
export const orderPlaceSchema = z.object({
  address: z.object({
    name: z.string().min(2),
    mobile: z.string().min(8),
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().min(4),
  }),
  paymentMethod: z.string(),
  couponCode: z.string().optional().nullable(),
  razorpay_payment_id: z.string().optional().nullable(),
  razorpay_order_id: z.string().optional().nullable(),
  razorpay_signature: z.string().optional().nullable(),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"]),
  description: z.string().optional(),
});

// Coupon Validator
export const couponCreateSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  minPurchase: z.number().nonnegative(),
  categoryIds: z.array(z.string()).optional().default([]),
  subcategoryIds: z.array(z.string()).optional().default([]),
  brandNames: z.array(z.string()).optional().default([]),
});

// Banner Validator
export const bannerCreateSchema = z.object({
  title: z.string().min(2),
  subtitle: z.string(),
  image: z.string(),
  link: z.string().optional().nullable(),
  type: z.array(z.string()).optional().default([]),
  categoryIds: z.array(z.string()).optional().default([]),
  subcategoryIds: z.array(z.string()).optional().default([]),
});

// Review Validator
export const reviewCreateSchema = z.object({
  productId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3),
  images: z.array(z.string().url()).optional(),
});

export const reviewModerateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectReason: z.string().optional().nullable(),
});

// Return request Validator
export const returnRequestCreateSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  productName: z.string(),
  thumbnail: z.string().url(),
  reason: z.string().min(5),
  evidenceImage: z.string().optional().nullable(),
});

export const returnRequestModerateSchema = z.object({
  status: z.enum(["Approved", "Rejected"]),
});

// User Block/Unblock Validator
export const userStatusUpdateSchema = z.object({
  blocked: z.boolean(),
});
