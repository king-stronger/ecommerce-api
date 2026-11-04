import { z } from "@hono/zod-openapi";
import { createSelectSchema } from "drizzle-zod";
import { categories, products, productVariants } from "@/db/schema.js";

export const selectCategorySchema = createSelectSchema(categories);
export const selectProductSchema = createSelectSchema(products);
export const selectProductVariantSchema = createSelectSchema(productVariants);

export const productImageSchema = z.object({
	url: z.url(),
	alt: z.string().optional(),
	sort: z.number().int().optional(),
});

export const insertCategorySchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	description: z.string().nullable().optional(),
	image: z.string().nullable().optional(),
	parentId: z.uuid().nullable().optional(),
	sortOrder: z.number().int().optional(),
	isActive: z.boolean().optional(),
});

export const updateCategorySchema = insertCategorySchema.partial();

export const insertProductSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	description: z.string().nullable().optional(),
	shortDescription: z.string().nullable().optional(),
	status: z.enum(["draft", "active", "archived"]).optional(),
	images: z.array(productImageSchema).optional(),
	categoryIds: z.array(z.uuid()).default([]),
});

export const updateProductSchema = insertProductSchema
	.omit({ categoryIds: true })
	.partial()
	.extend({
		categoryIds: z.array(z.uuid()).optional(),
	});

export const insertVariantSchema = z.object({
	name: z.string().min(1),
	sku: z.string().nullable().optional(),
	price: z.number().int().nonnegative(),
	compareAtPrice: z.number().int().nonnegative().nullable().optional(),
	stockQuantity: z.number().int().nonnegative().optional(),
	trackInventory: z.boolean().optional(),
	weight: z.number().int().nonnegative().nullable().optional(),
	options: z.record(z.string(), z.string()).nullable().optional(),
	images: z.array(productImageSchema).optional(),
	isDefault: z.boolean().optional(),
	isActive: z.boolean().optional(),
});

export const updateVariantSchema = insertVariantSchema.partial();

export const productWithVariantsSchema = selectProductSchema.extend({
	variants: z.array(selectProductVariantSchema),
	categoryIds: z.array(z.uuid()).optional(),
});

export const slugParamsSchema = z.object({
	slug: z
		.string()
		.min(1)
		.openapi({
			param: { name: "slug", in: "path" },
			example: "t-shirt",
		}),
});

export const listProductsQuerySchema = z.object({
	categorySlug: z
		.string()
		.optional()
		.openapi({
			param: { name: "categorySlug", in: "query" },
		}),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(20)
		.openapi({
			param: { name: "limit", in: "query" },
		}),
	offset: z.coerce
		.number()
		.int()
		.nonnegative()
		.default(0)
		.openapi({
			param: { name: "offset", in: "query" },
		}),
});

export const adminListQuerySchema = z.object({
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(20)
		.openapi({
			param: { name: "limit", in: "query" },
		}),
	offset: z.coerce
		.number()
		.int()
		.nonnegative()
		.default(0)
		.openapi({
			param: { name: "offset", in: "query" },
		}),
	status: z
		.enum(["draft", "active", "archived"])
		.optional()
		.openapi({
			param: { name: "status", in: "query" },
		}),
});

export const updateOrderStatusSchema = z.object({
	status: z.enum(["pending", "confirmed", "cancelled", "completed"]).optional(),
	paymentStatus: z
		.enum(["pending", "paid", "failed", "refunded", "partially_refunded"])
		.optional(),
	fulfillmentStatus: z
		.enum(["unfulfilled", "processing", "shipped", "delivered", "cancelled"])
		.optional(),
	trackingNumber: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
});
