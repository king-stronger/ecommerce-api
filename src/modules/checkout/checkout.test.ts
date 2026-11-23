import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { orders, productVariants } from "@/db/schema.js";
import {
	TEST_COUPON_CODE,
	TEST_EMAIL_DOMAIN,
	addToGuestCart,
	api,
	cleanupEcommerceFixtures,
	createTestUser,
	ensureTestCoupon,
	ensureTestShippingMethod,
	mergeCookies,
	seedSellableProduct,
	seedTestCoupon,
	testAddress,
	testDb,
} from "@/test/helpers.js";

describe("checkout", () => {
	const fixtures: {
		productIds: string[];
		cartSessionIds: string[];
		orderEmails: string[];
		userIds: string[];
	} = { productIds: [], cartSessionIds: [], orderEmails: [], userIds: [] };

	afterEach(async () => {
		await cleanupEcommerceFixtures({
			productIds: fixtures.productIds,
			cartSessionIds: fixtures.cartSessionIds,
			orderEmails: fixtures.orderEmails,
			userIds: fixtures.userIds,
		});
		fixtures.productIds = [];
		fixtures.cartSessionIds = [];
		fixtures.orderEmails = [];
		fixtures.userIds = [];
	});

	function trackSession(sessionId: string | null) {
		if (sessionId && !fixtures.cartSessionIds.includes(sessionId)) {
			fixtures.cartSessionIds.push(sessionId);
		}
	}

	it("lists active shipping methods (smoke)", async () => {
		await ensureTestShippingMethod();
		const res = await api("/shipping-methods");
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe(
			"public, max-age=300, stale-while-revalidate=86400",
		);
		const body = (await res.json()) as Array<{
			id: string;
			name: string;
			isActive: boolean;
		}>;
		expect(body.length).toBeGreaterThan(0);
		expect(body.every((method) => method.isActive)).toBe(true);
	});

	it("places an order from a guest cart and looks it up by number + email", async () => {
		const { product, variant } = await seedSellableProduct({ price: 5_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();
		await ensureTestCoupon();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const email = `buyer-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const checkoutRes = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Test",
				customerLastName: "Buyer",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				couponCode: TEST_COUPON_CODE,
				currency: "EUR",
			}),
		});
		expect(checkoutRes.status).toBe(201);
		const order = (await checkoutRes.json()) as {
			id: string;
			orderNumber: string;
			customerEmail: string;
			subtotal: number;
			discountAmount: number;
			shippingAmount: number;
			totalAmount: number;
			items: Array<{ productVariantId: string | null; quantity: number }>;
		};
		expect(order.customerEmail).toBe(email);
		expect(order.subtotal).toBe(5_000);
		expect(order.discountAmount).toBeGreaterThan(0);
		expect(order.shippingAmount).toBe(shipping.price);
		expect(order.totalAmount).toBe(
			order.subtotal - order.discountAmount + order.shippingAmount,
		);
		expect(order.items).toHaveLength(1);
		expect(order.items[0]?.productVariantId).toBe(variant.id);

		const lookupRes = await api(
			`/orders/${order.orderNumber}?email=${encodeURIComponent(email)}`,
		);
		expect(lookupRes.status).toBe(200);
		const lookedUp = (await lookupRes.json()) as { orderNumber: string };
		expect(lookedUp.orderNumber).toBe(order.orderNumber);

		const wrongEmail = await api(
			`/orders/${order.orderNumber}?email=${encodeURIComponent(`other@${TEST_EMAIL_DOMAIN}`)}`,
		);
		expect(wrongEmail.status).toBe(404);

		const db = testDb();
		const [row] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, order.id))
			.limit(1);
		expect(row?.customerEmail).toBe(email);
		expect(row?.totalAmount).toBe(order.totalAmount);
	});

	it("rejects checkout when the cart is empty", async () => {
		const shipping = await ensureTestShippingMethod();
		const email = `empty-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Empty",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(400);
	});

	it("rejects an unknown coupon with 404", async () => {
		const { product, variant } = await seedSellableProduct({ price: 5_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const email = `coupon-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Coupon",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				couponCode: "NOPE-NOT-A-REAL-COUPON",
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(404);
	});

	it("rejects an unknown shipping method with 404", async () => {
		const { product, variant } = await seedSellableProduct({ price: 5_000 });
		fixtures.productIds.push(product.id);

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const email = `ship-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Ship",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: "00000000-0000-4000-8000-000000000000",
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(404);
	});

	it("rejects a coupon when the subtotal is below the minimum", async () => {
		const coupon = await seedTestCoupon({ minOrderAmount: 10_000 });
		const { product, variant } = await seedSellableProduct({ price: 2_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const email = `min-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Min",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				couponCode: coupon.code,
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(409);
	});

	it("rejects an expired coupon with 409", async () => {
		const coupon = await seedTestCoupon({
			expiresAt: new Date(Date.now() - 60_000),
			minOrderAmount: 1_000,
		});
		const { product, variant } = await seedSellableProduct({ price: 5_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const email = `expired-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Expired",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				couponCode: coupon.code,
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(409);
	});

	it("rejects checkout when stock dropped below the cart quantity", async () => {
		const { product, variant } = await seedSellableProduct({
			price: 3_000,
			stockQuantity: 1,
		});
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const db = testDb();
		await db
			.update(productVariants)
			.set({ stockQuantity: 0 })
			.where(eq(productVariants.id, variant.id));

		const email = `stock-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const res = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Stock",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				currency: "EUR",
			}),
		});
		expect(res.status).toBe(409);
	});

	it("lists orders for the signed-in user", async () => {
		const user = await createTestUser({ name: "Order History" });
		fixtures.userIds.push(user.id);
		fixtures.orderEmails.push(user.email);

		const { product, variant } = await seedSellableProduct({ price: 4_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		trackSession(added.sessionId);

		const address = testAddress();
		const checkoutRes = await api("/checkout", {
			method: "POST",
			headers: {
				cookie: mergeCookies(added.cartCookie, user.cookie),
			},
			body: JSON.stringify({
				customerEmail: user.email,
				customerFirstName: "Order",
				customerLastName: "History",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				currency: "EUR",
			}),
		});
		expect(checkoutRes.status).toBe(201);
		const order = (await checkoutRes.json()) as { orderNumber: string };

		const unauthorized = await api("/orders");
		expect(unauthorized.status).toBe(401);

		const listRes = await api("/orders", {
			headers: { cookie: user.cookie },
		});
		expect(listRes.status).toBe(200);
		const list = (await listRes.json()) as Array<{
			orderNumber: string;
			itemCount: number;
			totalAmount: number;
		}>;
		expect(list.some((row) => row.orderNumber === order.orderNumber)).toBe(
			true,
		);
		const mine = list.find((row) => row.orderNumber === order.orderNumber);
		expect(mine?.itemCount).toBe(1);
		expect(mine?.totalAmount).toBeGreaterThan(0);
	});
});
