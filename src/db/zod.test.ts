import { describe, expect, it } from "vitest";
import {
	adminListQuerySchema,
	adminOrdersQuerySchema,
	insertProductSchema,
	insertVariantSchema,
	updateOrderStatusSchema,
} from "@/db/zod.js";
import {
	addCartItemSchema,
	updateCartItemSchema,
} from "@/modules/cart/cart.schemas.js";
import {
	addressSnapshotSchema,
	checkoutRequestSchema,
} from "@/modules/checkout/checkout.schemas.js";

describe("zod schemas", () => {
	it("accepts a valid add-cart-item payload", () => {
		const parsed = addCartItemSchema.parse({
			productVariantId: "11111111-1111-4111-8111-111111111111",
			quantity: 2,
		});
		expect(parsed.quantity).toBe(2);
	});

	it("defaults cart quantity to 1", () => {
		const parsed = addCartItemSchema.parse({
			productVariantId: "11111111-1111-4111-8111-111111111111",
		});
		expect(parsed.quantity).toBe(1);
	});

	it("rejects non-positive cart quantities", () => {
		expect(() =>
			updateCartItemSchema.parse({
				quantity: 0,
			}),
		).toThrow();
	});

	it("requires a complete checkout address", () => {
		expect(() =>
			addressSnapshotSchema.parse({
				firstName: "Ada",
				addressLine1: "1 Street",
				city: "Dublin",
			}),
		).toThrow();

		const address = addressSnapshotSchema.parse({
			firstName: "Ada",
			addressLine1: "1 Street",
			city: "Dublin",
			state: "Leinster",
			postalCode: "D02",
			country: "IE",
		});
		expect(address.country).toBe("IE");
	});

	it("defaults checkout currency to XOF", () => {
		const parsed = checkoutRequestSchema.parse({
			customerEmail: "buyer@example.com",
			customerFirstName: "Ada",
			shippingAddress: {
				firstName: "Ada",
				addressLine1: "1 Street",
				city: "Dublin",
				state: "Leinster",
				postalCode: "D02",
				country: "IE",
			},
			billingAddress: {
				firstName: "Ada",
				addressLine1: "1 Street",
				city: "Dublin",
				state: "Leinster",
				postalCode: "D02",
				country: "IE",
			},
		});
		expect(parsed.currency).toBe("XOF");
	});

	it("parses admin list query defaults and filters", () => {
		expect(adminListQuerySchema.parse({})).toMatchObject({
			limit: 10,
			offset: 0,
		});
		expect(
			adminListQuerySchema.parse({
				limit: "20",
				offset: "10",
				status: "active",
				q: "dress",
			}),
		).toMatchObject({
			limit: 20,
			offset: 10,
			status: "active",
			q: "dress",
		});
	});

	it("requires product name/slug and non-negative variant price", () => {
		expect(() => insertProductSchema.parse({ name: "", slug: "x" })).toThrow();
		const product = insertProductSchema.parse({
			name: "Coat",
			slug: "coat",
		});
		expect(product.categoryIds).toEqual([]);

		expect(() =>
			insertVariantSchema.parse({
				name: "M",
				price: -1,
			}),
		).toThrow();
	});

	it("parses admin orders query defaults and status filter", () => {
		expect(adminOrdersQuerySchema.parse({})).toMatchObject({
			limit: 10,
			offset: 0,
		});
		expect(
			adminOrdersQuerySchema.parse({
				status: "confirmed",
				q: "ORD-1",
				limit: "5",
			}),
		).toMatchObject({
			status: "confirmed",
			q: "ORD-1",
			limit: 5,
		});
		expect(() =>
			adminOrdersQuerySchema.parse({ status: "paid" }),
		).toThrow();
	});

	it("accepts partial order status patches", () => {
		expect(
			updateOrderStatusSchema.parse({
				status: "completed",
				paymentStatus: "paid",
			}),
		).toMatchObject({
			status: "completed",
			paymentStatus: "paid",
		});
		expect(updateOrderStatusSchema.parse({})).toEqual({});
	});
});
