CREATE TABLE IF NOT EXISTS "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision NOT NULL,
	"tax" double precision NOT NULL,
	"total" double precision NOT NULL,
	"address" jsonb NOT NULL,
	"coupon_code" text,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_subcategory_id_subcategories_id_fk";
--> statement-breakpoint
ALTER TABLE "banners" ALTER COLUMN "link" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ALTER COLUMN "type" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "banners" ALTER COLUMN "type" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "subcategory_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "subcategory_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "brand_names" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "razorpay_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "evidence_image" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reject_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "checkout_sessions" ADD CONSTRAINT "checkout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN IF EXISTS "category_id";--> statement-breakpoint
ALTER TABLE "coupons" DROP COLUMN IF EXISTS "subcategory_id";