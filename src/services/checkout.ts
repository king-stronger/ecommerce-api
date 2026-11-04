import { and, eq, gte, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { DB } from "@/db/db.js";
import {
	cartItems,
	coupons,
	customers,
	orderItems,
	orders,
	productVariants,
	shippingMethods,
} from "@/db/schema.js";
import type { AddressSnapshot } from "@/db/schemas/shared.js";
import type { AppBindings } from "@/lib/types.js";
import { getGuestCartOrNull, loadCartView } from "./cart.js";
import { clearCartSessionId } from "./cart-session.js";

export type CheckoutInput = {
	customerEmail: string;
	customerPhone?: string;
	customerFirstName: string;
	customerLastName?: string;
	shippingAddress: AddressSnapshot;
	billingAddress: AddressSnapshot;
	shippingMethodId?: string;
	couponCode?: string;
	currency: string;
	notes?: string;
};

export type OrderView = {
	id: string;
	orderNumber: string;
	status: string;
	paymentStatus: string;
	fulfillmentStatus: string;
	currency: string;
	subtotal: number;
	discountAmount: number;
	shippingAmount: number;
	taxAmount: number;
	totalAmount: number;
	customerEmail: string;
	customerPhone: string | null;
	shippingAddress: AddressSnapshot;
	billingAddress: AddressSnapshot;
	shippingMethodName: string | null;
	trackingNumber: string | null;
	notes: string | null;
	createdAt: Date;
	items: Array<{
		id: string;
		productId: string | null;
		productVariantId: string | null;
		productName: string;
		variantName: string | null;
		sku: string | null;
		unitPrice: number;
		quantity: number;
		discountAmount: number;
		totalAmount: number;
	}>;
};

function generateOrderNumber() {
	const stamp = Date.now().toString(36).toUpperCase();
	const rand = crypto.randomUUID().slice(0, 4).toUpperCase();
	return `ORD-${stamp}-${rand}`;
}

export async function listActiveShippingMethods(db: DB) {
	return db
		.select()
		.from(shippingMethods)
		.where(eq(shippingMethods.isActive, true))
		.orderBy(shippingMethods.sortOrder, shippingMethods.name);
}

async function resolveCoupon(
	db: DB,
	code: string | undefined,
	subtotal: number,
) {
	if (!code) {
		return { couponId: null as string | null, discountAmount: 0 };
	}

	const normalized = code.trim().toUpperCase();
	const [coupon] = await db
		.select()
		.from(coupons)
		.where(and(eq(coupons.code, normalized), eq(coupons.isActive, true)))
		.limit(1);

	if (!coupon) {
		throw new CheckoutError("NOT_FOUND", "Coupon not found");
	}

	const now = new Date();
	if (coupon.startsAt && coupon.startsAt > now) {
		throw new CheckoutError("CONFLICT", "Coupon is not active yet");
	}
	if (coupon.expiresAt && coupon.expiresAt < now) {
		throw new CheckoutError("CONFLICT", "Coupon has expired");
	}
	if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
		throw new CheckoutError("CONFLICT", "Coupon usage limit reached");
	}
	if (coupon.minOrderAmount !== null && subtotal < coupon.minOrderAmount) {
		throw new CheckoutError("CONFLICT", "Order subtotal below coupon minimum");
	}

	let discountAmount =
		coupon.type === "percentage"
			? Math.floor((subtotal * coupon.value) / 100)
			: coupon.value;

	if (coupon.maxDiscountAmount !== null) {
		discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
	}
	discountAmount = Math.min(discountAmount, subtotal);

	return { couponId: coupon.id, discountAmount };
}

async function ensureCustomer(
	db: DB,
	input: CheckoutInput,
	userId: string | null,
) {
	if (userId) {
		const [byUser] = await db
			.select()
			.from(customers)
			.where(eq(customers.userId, userId))
			.limit(1);
		if (byUser) {
			const [updated] = await db
				.update(customers)
				.set({
					email: input.customerEmail,
					firstName: input.customerFirstName,
					lastName: input.customerLastName,
					phone: input.customerPhone,
				})
				.where(eq(customers.id, byUser.id))
				.returning();
			return updated;
		}
	}

	const [created] = await db
		.insert(customers)
		.values({
			userId,
			email: input.customerEmail,
			firstName: input.customerFirstName,
			lastName: input.customerLastName,
			phone: input.customerPhone,
		})
		.returning();
	return created;
}

export class CheckoutError extends Error {
	constructor(
		readonly code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST",
		message: string,
	) {
		super(message);
		this.name = "CheckoutError";
	}
}

export async function createCheckoutOrder(
	c: Context<AppBindings>,
	input: CheckoutInput,
) {
	const db = c.var.db;
	const cart = await getGuestCartOrNull(c);
	if (!cart) {
		throw new CheckoutError("BAD_REQUEST", "Cart is empty");
	}

	const cartView = await loadCartView(db, cart.id);
	if (cartView.items.length === 0) {
		throw new CheckoutError("BAD_REQUEST", "Cart is empty");
	}

	for (const item of cartView.items) {
		const [variant] = await db
			.select()
			.from(productVariants)
			.where(eq(productVariants.id, item.productVariantId))
			.limit(1);

		if (!variant || !variant.isActive) {
			throw new CheckoutError(
				"CONFLICT",
				`Variant unavailable: ${item.variantName}`,
			);
		}
		if (variant.trackInventory && variant.stockQuantity < item.quantity) {
			throw new CheckoutError(
				"CONFLICT",
				`Insufficient stock for ${item.variantName}`,
			);
		}
	}

	let shippingAmount = 0;
	let shippingMethodName: string | null = null;
	let currency = input.currency;

	if (input.shippingMethodId) {
		const [method] = await db
			.select()
			.from(shippingMethods)
			.where(
				and(
					eq(shippingMethods.id, input.shippingMethodId),
					eq(shippingMethods.isActive, true),
				),
			)
			.limit(1);

		if (!method) {
			throw new CheckoutError("NOT_FOUND", "Shipping method not found");
		}
		shippingAmount = method.price;
		shippingMethodName = method.name;
		currency = method.currency;
	}

	const { couponId, discountAmount } = await resolveCoupon(
		db,
		input.couponCode,
		cartView.subtotal,
	);

	const taxAmount = 0;
	const totalAmount = Math.max(
		0,
		cartView.subtotal - discountAmount + shippingAmount + taxAmount,
	);

	const user = c.get("user");
	const customer = await ensureCustomer(db, input, user?.id ?? null);

	const [order] = await db
		.insert(orders)
		.values({
			orderNumber: generateOrderNumber(),
			customerId: customer.id,
			currency,
			subtotal: cartView.subtotal,
			discountAmount,
			shippingAmount,
			taxAmount,
			totalAmount,
			couponId,
			customerEmail: input.customerEmail,
			customerPhone: input.customerPhone,
			shippingAddress: input.shippingAddress,
			billingAddress: input.billingAddress,
			shippingMethodId: input.shippingMethodId,
			shippingMethodName,
			notes: input.notes,
		})
		.returning();

	await db.insert(orderItems).values(
		cartView.items.map((item) => ({
			orderId: order.id,
			productId: item.productId,
			productVariantId: item.productVariantId,
			productName: item.productName,
			variantName: item.variantName,
			sku: item.sku,
			unitPrice: item.unitPrice,
			quantity: item.quantity,
			discountAmount: 0,
			totalAmount: item.lineTotal,
		})),
	);

	for (const item of cartView.items) {
		const [variant] = await db
			.select()
			.from(productVariants)
			.where(eq(productVariants.id, item.productVariantId))
			.limit(1);

		if (!variant?.trackInventory) {
			continue;
		}

		const updated = await db
			.update(productVariants)
			.set({
				stockQuantity: sql`${productVariants.stockQuantity} - ${item.quantity}`,
			})
			.where(
				and(
					eq(productVariants.id, item.productVariantId),
					gte(productVariants.stockQuantity, item.quantity),
				),
			)
			.returning({ id: productVariants.id });

		if (updated.length === 0) {
			await db
				.update(orders)
				.set({ status: "cancelled", paymentStatus: "failed" })
				.where(eq(orders.id, order.id));
			throw new CheckoutError(
				"CONFLICT",
				`Insufficient stock for ${item.variantName}`,
			);
		}
	}

	if (couponId) {
		await db
			.update(coupons)
			.set({ usedCount: sql`${coupons.usedCount} + 1` })
			.where(eq(coupons.id, couponId));
	}

	await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
	clearCartSessionId(c);

	return loadOrderView(db, order.id);
}

export async function loadOrderView(
	db: DB,
	orderId: string,
): Promise<OrderView | null> {
	const [order] = await db
		.select()
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);

	if (!order) {
		return null;
	}

	const items = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.orderId, order.id));

	return {
		id: order.id,
		orderNumber: order.orderNumber,
		status: order.status,
		paymentStatus: order.paymentStatus,
		fulfillmentStatus: order.fulfillmentStatus,
		currency: order.currency,
		subtotal: order.subtotal,
		discountAmount: order.discountAmount,
		shippingAmount: order.shippingAmount,
		taxAmount: order.taxAmount,
		totalAmount: order.totalAmount,
		customerEmail: order.customerEmail,
		customerPhone: order.customerPhone,
		shippingAddress: order.shippingAddress,
		billingAddress: order.billingAddress,
		shippingMethodName: order.shippingMethodName,
		trackingNumber: order.trackingNumber,
		notes: order.notes,
		createdAt: order.createdAt,
		items: items.map((item) => ({
			id: item.id,
			productId: item.productId,
			productVariantId: item.productVariantId,
			productName: item.productName,
			variantName: item.variantName,
			sku: item.sku,
			unitPrice: item.unitPrice,
			quantity: item.quantity,
			discountAmount: item.discountAmount,
			totalAmount: item.totalAmount,
		})),
	};
}

export async function findOrderByNumber(db: DB, orderNumber: string) {
	const [order] = await db
		.select()
		.from(orders)
		.where(eq(orders.orderNumber, orderNumber))
		.limit(1);
	if (!order) {
		return null;
	}
	return loadOrderView(db, order.id);
}
