import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DB } from "@/db/db.js";
import { cartItems, carts, products, productVariants } from "@/db/schema.js";
import type { AppBindings } from "@/lib/types.js";
import { ensureCartSessionId, getCartSessionId } from "./cart-session.js";

export type CartItemView = {
	id: string;
	quantity: number;
	productVariantId: string;
	productId: string;
	productName: string;
	productSlug: string;
	variantName: string;
	sku: string | null;
	unitPrice: number;
	lineTotal: number;
};

export type CartView = {
	id: string;
	sessionId: string | null;
	items: CartItemView[];
	subtotal: number;
};

export async function findCartBySessionId(db: DB, sessionId: string) {
	const [cart] = await db
		.select()
		.from(carts)
		.where(eq(carts.sessionId, sessionId))
		.limit(1);
	return cart ?? null;
}

export async function getOrCreateGuestCart(c: Context<AppBindings>) {
	const sessionId = ensureCartSessionId(c);
	const existing = await findCartBySessionId(c.var.db, sessionId);
	if (existing) {
		return existing;
	}

	const [created] = await c.var.db
		.insert(carts)
		.values({ sessionId })
		.returning();
	return created;
}

export async function getGuestCartOrNull(c: Context<AppBindings>) {
	const sessionId = getCartSessionId(c);
	if (!sessionId) {
		return null;
	}
	return findCartBySessionId(c.var.db, sessionId);
}

export async function loadCartView(db: DB, cartId: string): Promise<CartView> {
	const [cart] = await db
		.select()
		.from(carts)
		.where(eq(carts.id, cartId))
		.limit(1);

	if (!cart) {
		return {
			id: cartId,
			sessionId: null,
			items: [],
			subtotal: 0,
		};
	}

	const rows = await db
		.select({
			id: cartItems.id,
			quantity: cartItems.quantity,
			productVariantId: cartItems.productVariantId,
			productId: products.id,
			productName: products.name,
			productSlug: products.slug,
			variantName: productVariants.name,
			sku: productVariants.sku,
			unitPrice: productVariants.price,
		})
		.from(cartItems)
		.innerJoin(
			productVariants,
			eq(cartItems.productVariantId, productVariants.id),
		)
		.innerJoin(products, eq(productVariants.productId, products.id))
		.where(eq(cartItems.cartId, cartId));

	const items: CartItemView[] = rows.map((row) => ({
		...row,
		lineTotal: row.unitPrice * row.quantity,
	}));

	return {
		id: cart.id,
		sessionId: cart.sessionId,
		items,
		subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
	};
}

export async function findSellableVariant(db: DB, productVariantId: string) {
	const [row] = await db
		.select({
			variant: productVariants,
			productStatus: products.status,
		})
		.from(productVariants)
		.innerJoin(products, eq(productVariants.productId, products.id))
		.where(
			and(
				eq(productVariants.id, productVariantId),
				eq(productVariants.isActive, true),
			),
		)
		.limit(1);

	if (row?.productStatus !== "active") {
		return null;
	}

	return row.variant;
}
