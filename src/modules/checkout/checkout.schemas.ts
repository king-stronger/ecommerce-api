import { z } from "@hono/zod-openapi";
import { createSelectSchema } from "drizzle-zod";
import { shippingMethods } from "@/db/schema.js";

export const addressSnapshotSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().optional(),
	company: z.string().optional(),
	phone: z.string().optional(),
	addressLine1: z.string().min(1),
	addressLine2: z.string().optional(),
	city: z.string().min(1),
	state: z.string().min(1),
	postalCode: z.string().min(1),
	country: z.string().min(2).max(2),
});

export const selectShippingMethodSchema = createSelectSchema(shippingMethods);

export const checkoutRequestSchema = z.object({
	customerEmail: z.email(),
	customerPhone: z.string().optional(),
	customerFirstName: z.string().min(1),
	customerLastName: z.string().optional(),
	shippingAddress: addressSnapshotSchema,
	billingAddress: addressSnapshotSchema,
	shippingMethodId: z.uuid().optional(),
	couponCode: z.string().min(1).optional(),
	currency: z.string().min(3).max(3).default("XOF"),
	notes: z.string().optional(),
});

export const orderItemViewSchema = z.object({
	id: z.uuid(),
	productId: z.uuid().nullable(),
	productVariantId: z.uuid().nullable(),
	productName: z.string(),
	variantName: z.string().nullable(),
	sku: z.string().nullable(),
	unitPrice: z.number().int().nonnegative(),
	quantity: z.number().int().positive(),
	discountAmount: z.number().int().nonnegative(),
	totalAmount: z.number().int().nonnegative(),
});

export const orderViewSchema = z.object({
	id: z.uuid(),
	orderNumber: z.string(),
	status: z.string(),
	paymentStatus: z.string(),
	fulfillmentStatus: z.string(),
	currency: z.string(),
	subtotal: z.number().int().nonnegative(),
	discountAmount: z.number().int().nonnegative(),
	shippingAmount: z.number().int().nonnegative(),
	taxAmount: z.number().int().nonnegative(),
	totalAmount: z.number().int().nonnegative(),
	customerEmail: z.string(),
	customerPhone: z.string().nullable(),
	shippingAddress: addressSnapshotSchema,
	billingAddress: addressSnapshotSchema,
	shippingMethodName: z.string().nullable(),
	trackingNumber: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.coerce.date(),
	items: z.array(orderItemViewSchema),
});

export const orderNumberParamsSchema = z.object({
	orderNumber: z
		.string()
		.min(1)
		.openapi({
			param: { name: "orderNumber", in: "path" },
			example: "ORD-ABC123-XYZ9",
		}),
});

export const getOrderQuerySchema = z.object({
	email: z.email().openapi({
		param: { name: "email", in: "query" },
	}),
});
