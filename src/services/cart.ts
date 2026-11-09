import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { DB } from "@/db/db.js";
import { cartItems, carts, products, productVariants } from "@/db/schema.js";
import type { AppBindings } from "@/lib/types.js";
import { ensureCartSessionId, getCartSessionId } from "./cart-session.js";

function firstProductImage(images: unknown): string | null {
	if (!Array.isArray(images)) return null;
	const first = images[0];
	if (first && typeof first === "object" && "url" in first) {
		const url = (first as { url?: unknown }).url;
		return typeof url === "string" ? url : null;
	}
	return null;
}

export type CartItemView = {
	id: string;
	quantity: number;
	productVariantId: string;
	productId: string;
	productName: string;
	productSlug: string;
	productImage: string | null;
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
			productImages: products.images,
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

	const items: CartItemView[] = rows.map((row) => {
		const { productImages, ...rest } = row;
		return {
			...rest,
			productImage: firstProductImage(productImages),
			lineTotal: row.unitPrice * row.quantity,
		};
	});

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
