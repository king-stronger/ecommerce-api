import { z } from "@hono/zod-openapi";
import { createSelectSchema } from "drizzle-zod";
import { cartItems, carts } from "@/db/schema.js";

export const selectCartSchema = createSelectSchema(carts);
export const selectCartItemSchema = createSelectSchema(cartItems);

export const cartItemViewSchema = z.object({
	id: z.uuid(),
	quantity: z.number().int().positive(),
	productVariantId: z.uuid(),
	productId: z.uuid(),
	productName: z.string(),
	productSlug: z.string(),
	variantName: z.string(),
	sku: z.string().nullable(),
	unitPrice: z.number().int().nonnegative(),
	lineTotal: z.number().int().nonnegative(),
});

export const cartViewSchema = z.object({
	id: z.uuid().nullable(),
	sessionId: z.string().nullable(),
	items: z.array(cartItemViewSchema),
	subtotal: z.number().int().nonnegative(),
});

export const addCartItemSchema = z.object({
	productVariantId: z.uuid(),
	quantity: z.number().int().positive().default(1),
});

export const updateCartItemSchema = z.object({
	quantity: z.number().int().positive(),
});

export const cartItemIdParamsSchema = z.object({
	id: z.uuid().openapi({
		param: { name: "id", in: "path" },
	}),
});
