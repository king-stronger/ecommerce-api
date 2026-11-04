import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { cartItems } from "@/db/schema.js";
import type { AppRouteHandler } from "@/lib/types.js";
import {
	findSellableVariant,
	getGuestCartOrNull,
	getOrCreateGuestCart,
	loadCartView,
} from "@/services/cart.js";
import type {
	AddCartItemRoute,
	ClearCartRoute,
	GetCartRoute,
	RemoveCartItemRoute,
	UpdateCartItemRoute,
} from "./cart.routes.js";
import {
	addCartItemSchema,
	cartItemIdParamsSchema,
	updateCartItemSchema,
} from "./cart.schemas.js";

const emptyCart = {
	id: null,
	sessionId: null,
	items: [],
	subtotal: 0,
};

export const getCart: AppRouteHandler<GetCartRoute> = async (c) => {
	const cart = await getGuestCartOrNull(c);
	if (!cart) {
		return c.json(emptyCart, HttpStatusCodes.OK);
	}
	return c.json(await loadCartView(c.var.db, cart.id), HttpStatusCodes.OK);
};

export const addCartItem: AppRouteHandler<AddCartItemRoute> = async (c) => {
	const body = addCartItemSchema.parse(await c.req.json());
	const variant = await findSellableVariant(c.var.db, body.productVariantId);

	if (!variant) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const cart = await getOrCreateGuestCart(c);

	const [existing] = await c.var.db
		.select()
		.from(cartItems)
		.where(
			and(
				eq(cartItems.cartId, cart.id),
				eq(cartItems.productVariantId, body.productVariantId),
			),
		)
		.limit(1);

	const nextQuantity = (existing?.quantity ?? 0) + body.quantity;

	if (variant.trackInventory && nextQuantity > variant.stockQuantity) {
		return c.json(
			{ message: HttpStatusPhrases.CONFLICT },
			HttpStatusCodes.CONFLICT,
		);
	}

	if (existing) {
		await c.var.db
			.update(cartItems)
			.set({ quantity: nextQuantity })
			.where(eq(cartItems.id, existing.id));
	} else {
		await c.var.db.insert(cartItems).values({
			cartId: cart.id,
			productVariantId: body.productVariantId,
			quantity: body.quantity,
		});
	}

	return c.json(await loadCartView(c.var.db, cart.id), HttpStatusCodes.OK);
};

export const updateCartItem: AppRouteHandler<UpdateCartItemRoute> = async (
	c,
) => {
	const { id } = cartItemIdParamsSchema.parse(c.req.param());
	const body = updateCartItemSchema.parse(await c.req.json());
	const cart = await getGuestCartOrNull(c);

	if (!cart) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const [item] = await c.var.db
		.select()
		.from(cartItems)
		.where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)))
		.limit(1);

	if (!item) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const variant = await findSellableVariant(c.var.db, item.productVariantId);
	if (!variant) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	if (variant.trackInventory && body.quantity > variant.stockQuantity) {
		return c.json(
			{ message: HttpStatusPhrases.CONFLICT },
			HttpStatusCodes.CONFLICT,
		);
	}

	await c.var.db
		.update(cartItems)
		.set({ quantity: body.quantity })
		.where(eq(cartItems.id, item.id));

	return c.json(await loadCartView(c.var.db, cart.id), HttpStatusCodes.OK);
};

export const removeCartItem: AppRouteHandler<RemoveCartItemRoute> = async (
	c,
) => {
	const { id } = cartItemIdParamsSchema.parse(c.req.param());
	const cart = await getGuestCartOrNull(c);

	if (!cart) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const deleted = await c.var.db
		.delete(cartItems)
		.where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)))
		.returning({ id: cartItems.id });

	if (deleted.length === 0) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(await loadCartView(c.var.db, cart.id), HttpStatusCodes.OK);
};

export const clearCart: AppRouteHandler<ClearCartRoute> = async (c) => {
	const cart = await getGuestCartOrNull(c);
	if (!cart) {
		return c.json(emptyCart, HttpStatusCodes.OK);
	}

	await c.var.db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
	return c.json(await loadCartView(c.var.db, cart.id), HttpStatusCodes.OK);
};
