import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { cartItems, carts } from "@/db/schema.js";
import {
	addToGuestCart,
	api,
	cleanupEcommerceFixtures,
	mergeCookies,
	seedSellableProduct,
	testDb,
} from "@/test/helpers.js";

describe("cart", () => {
	const fixtures: {
		productIds: string[];
		cartSessionIds: string[];
	} = { productIds: [], cartSessionIds: [] };

	afterEach(async () => {
		await cleanupEcommerceFixtures({
			productIds: fixtures.productIds,
			cartSessionIds: fixtures.cartSessionIds,
		});
		fixtures.productIds = [];
		fixtures.cartSessionIds = [];
	});

	function trackSession(sessionId: string | null) {
		if (sessionId && !fixtures.cartSessionIds.includes(sessionId)) {
			fixtures.cartSessionIds.push(sessionId);
		}
	}

	it("starts empty without a cart session cookie", async () => {
		const res = await api("/cart");
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			id: string | null;
			items: unknown[];
			subtotal: number;
		};
		expect(body.id).toBeNull();
		expect(body.items).toEqual([]);
		expect(body.subtotal).toBe(0);
	});

	it("adds a sellable variant and persists it for the cart_session cookie", async () => {
		const { product, variant } = await seedSellableProduct({ price: 3_900 });
		fixtures.productIds.push(product.id);

		const { res: addRes, cartCookie, sessionId } = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 2,
		});
		expect(addRes.status).toBe(200);
		expect(cartCookie).toBeTruthy();
		trackSession(sessionId);

		const body = (await addRes.json()) as {
			id: string;
			items: Array<{
				productVariantId: string;
				quantity: number;
				unitPrice: number;
				lineTotal: number;
				productImage: string | null;
			}>;
			subtotal: number;
		};
		expect(body.items).toHaveLength(1);
		expect(body.items[0]?.productVariantId).toBe(variant.id);
		expect(body.items[0]?.quantity).toBe(2);
		expect(body.items[0]?.unitPrice).toBe(3_900);
		expect(body.items[0]?.lineTotal).toBe(7_800);
		expect(body.subtotal).toBe(7_800);
		expect(body.items[0]?.productImage).toBeTruthy();

		const getRes = await api("/cart", {
			headers: { cookie: mergeCookies(cartCookie) },
		});
		expect(getRes.status).toBe(200);
		const again = (await getRes.json()) as typeof body;
		expect(again.items).toHaveLength(1);
		expect(again.subtotal).toBe(7_800);

		const db = testDb();
		const [cartRow] = await db
			.select()
			.from(carts)
			.where(eq(carts.sessionId, sessionId as string))
			.limit(1);
		expect(cartRow).toBeTruthy();
		const lines = await db
			.select()
			.from(cartItems)
			.where(eq(cartItems.cartId, cartRow.id));
		expect(lines).toHaveLength(1);
		expect(lines[0]?.quantity).toBe(2);
	});

	it("updates and removes a line, then clears the cart", async () => {
		const { product, variant } = await seedSellableProduct({ price: 2_000 });
		fixtures.productIds.push(product.id);

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);
		const created = (await added.res.json()) as {
			items: Array<{ id: string; quantity: number }>;
		};
		const itemId = created.items[0]?.id as string;

		const updateRes = await api(`/cart/items/${itemId}`, {
			method: "PATCH",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({ quantity: 3 }),
		});
		expect(updateRes.status).toBe(200);
		const updated = (await updateRes.json()) as {
			items: Array<{ id: string; quantity: number; lineTotal: number }>;
			subtotal: number;
		};
		expect(updated.items[0]?.quantity).toBe(3);
		expect(updated.subtotal).toBe(6_000);

		const removeRes = await api(`/cart/items/${itemId}`, {
			method: "DELETE",
			headers: { cookie: mergeCookies(added.cartCookie) },
		});
		expect(removeRes.status).toBe(200);
		const removed = (await removeRes.json()) as {
			items: unknown[];
			subtotal: number;
		};
		expect(removed.items).toEqual([]);
		expect(removed.subtotal).toBe(0);

		const refill = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
			cookie: added.cartCookie,
		});
		expect(refill.res.status).toBe(200);

		const clearRes = await api("/cart", {
			method: "DELETE",
			headers: { cookie: mergeCookies(added.cartCookie) },
		});
		expect(clearRes.status).toBe(200);
		const cleared = (await clearRes.json()) as {
			items: unknown[];
			subtotal: number;
		};
		expect(cleared.items).toEqual([]);
		expect(cleared.subtotal).toBe(0);
	});

	it("rejects quantities above tracked stock with 409", async () => {
		const { product, variant } = await seedSellableProduct({
			price: 1_000,
			stockQuantity: 2,
		});
		fixtures.productIds.push(product.id);

		const res = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 3,
		});
		trackSession(res.sessionId);
		expect(res.res.status).toBe(409);
	});

	it("increments quantity when the same variant is added again", async () => {
		const { product, variant } = await seedSellableProduct({
			price: 1_500,
			stockQuantity: 10,
		});
		fixtures.productIds.push(product.id);

		const first = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 2,
		});
		expect(first.res.status).toBe(200);
		trackSession(first.sessionId);

		const second = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 3,
			cookie: first.cartCookie,
		});
		expect(second.res.status).toBe(200);
		const body = (await second.res.json()) as {
			items: Array<{ productVariantId: string; quantity: number; lineTotal: number }>;
			subtotal: number;
		};
		expect(body.items).toHaveLength(1);
		expect(body.items[0]?.quantity).toBe(5);
		expect(body.subtotal).toBe(7_500);
	});

	it("rejects PATCH quantities above tracked stock with 409", async () => {
		const { product, variant } = await seedSellableProduct({
			price: 1_000,
			stockQuantity: 2,
		});
		fixtures.productIds.push(product.id);

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);
		const created = (await added.res.json()) as {
			items: Array<{ id: string }>;
		};

		const updateRes = await api(`/cart/items/${created.items[0]?.id}`, {
			method: "PATCH",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({ quantity: 5 }),
		});
		expect(updateRes.status).toBe(409);
	});

	it("rejects unknown variants with 404", async () => {
		const res = await api("/cart/items", {
			method: "POST",
			body: JSON.stringify({
				productVariantId: "00000000-0000-4000-8000-000000000000",
				quantity: 1,
			}),
		});
		expect(res.status).toBe(404);
	});
});
