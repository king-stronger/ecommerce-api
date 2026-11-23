import { eq, inArray, like } from "drizzle-orm";
import app from "@/app.js";
import { createDb } from "@/db/db.js";
import {
	account,
	cartItems,
	carts,
	categories,
	coupons,
	orderItems,
	orders,
	payments,
	productCategories,
	products,
	productVariants,
	session,
	shippingMethods,
	user,
} from "@/db/schema.js";
import { createAuth } from "@/lib/auth.js";
import { CART_SESSION_COOKIE } from "@/services/cart-session.js";
import { getTestEnv } from "./env.js";

/** Disposable emails + slug prefix for this repo's fixtures. */
export const TEST_EMAIL_DOMAIN = "ecommerce.test";
export const TEST_SLUG_PREFIX = "test-ecom-";
export const TEST_COUPON_CODE = "TESTECOM10";
const TEST_COUPON_PREFIX = "TESTECOM-";
const TEST_SHIPPING_NAME = "Test Ecom Standard";

function testEnv(overrides: Partial<Env> = {}) {
	return getTestEnv(overrides);
}

export function testDb(env: Env = testEnv()) {
	return createDb(env);
}

export async function api(
	path: string,
	init: RequestInit = {},
	env: Env = testEnv(),
) {
	const headers = new Headers(init.headers);
	if (init.body && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	return app.request(
		path,
		{
			...init,
			headers,
		},
		env,
	);
}

function setCookiesFromResponse(response: Response) {
	const headersWithGetSetCookie = response.headers as Headers & {
		getSetCookie?: () => string[];
	};
	return (
		headersWithGetSetCookie.getSetCookie?.() ??
		(response.headers.get("set-cookie")
			? [response.headers.get("set-cookie") as string]
			: [])
	);
}

function cookiePair(setCookie: string) {
	return setCookie.split(";")[0] ?? setCookie;
}

function cookieFromAuthResponse(response: Response) {
	const sessionCookie = setCookiesFromResponse(response).find((value) =>
		value.startsWith("better-auth.session_token="),
	);
	if (!sessionCookie) {
		throw new Error("No better-auth.session_token cookie in auth response");
	}
	return cookiePair(sessionCookie);
}

function cartSessionFromResponse(response: Response) {
	const cartCookie = setCookiesFromResponse(response).find((value) =>
		value.startsWith(`${CART_SESSION_COOKIE}=`),
	);
	if (!cartCookie) {
		return null;
	}
	return cookiePair(cartCookie);
}

export function mergeCookies(...parts: Array<string | null | undefined>) {
	return parts.filter(Boolean).join("; ");
}

export type TestUser = {
	id: string;
	email: string;
	name: string;
	cookie: string;
};

export async function createTestUser(input?: {
	email?: string;
	name?: string;
	password?: string;
	role?: string | null;
}): Promise<TestUser> {
	const env = testEnv();
	const db = testDb(env);
	const auth = createAuth(env, db);
	const suffix = crypto.randomUUID().slice(0, 8);
	const email = input?.email ?? `user-${suffix}@${TEST_EMAIL_DOMAIN}`;
	const name = input?.name ?? `Test User ${suffix}`;
	const password = input?.password ?? "test-password-123456";

	const response = await auth.api.signUpEmail({
		body: { email, password, name },
		asResponse: true,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`signUpEmail failed (${response.status}): ${body}`);
	}

	const cookie = cookieFromAuthResponse(response);
	const created = await db.query.user.findFirst({
		where: eq(user.email, email),
	});
	if (!created) {
		throw new Error(`User not found after signup: ${email}`);
	}

	if (input?.role !== undefined) {
		await db
			.update(user)
			.set({ role: input.role })
			.where(eq(user.id, created.id));
	}

	return {
		id: created.id,
		email,
		name,
		cookie,
	};
}

export async function seedSellableProduct(input?: {
	slug?: string;
	name?: string;
	price?: number;
	stockQuantity?: number;
	status?: "draft" | "active" | "archived";
	categoryId?: string;
}) {
	const db = testDb();
	const suffix = crypto.randomUUID().slice(0, 8);
	const slug = input?.slug ?? `${TEST_SLUG_PREFIX}${suffix}`;

	const [product] = await db
		.insert(products)
		.values({
			name: input?.name ?? `Test Product ${suffix}`,
			slug,
			description: "Fixture product for ecommerce-api tests",
			shortDescription: "Fixture",
			status: input?.status ?? "active",
			images: [
				{
					url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
					alt: "Fixture",
					sort: 0,
				},
			],
		})
		.returning();

	const [variant] = await db
		.insert(productVariants)
		.values({
			productId: product.id,
			name: "Default",
			sku: `TEST-SKU-${suffix}`,
			price: input?.price ?? 5_000,
			stockQuantity: input?.stockQuantity ?? 25,
			trackInventory: true,
			isDefault: true,
			isActive: true,
		})
		.returning();

	if (input?.categoryId) {
		await db.insert(productCategories).values({
			productId: product.id,
			categoryId: input.categoryId,
		});
	}

	return { product, variant };
}

export async function seedTestCategory(input?: {
	slug?: string;
	name?: string;
	isActive?: boolean;
}) {
	const db = testDb();
	const suffix = crypto.randomUUID().slice(0, 8);
	const [category] = await db
		.insert(categories)
		.values({
			name: input?.name ?? `Test Category ${suffix}`,
			slug: input?.slug ?? `${TEST_SLUG_PREFIX}cat-${suffix}`,
			description: "Fixture category for ecommerce-api tests",
			isActive: input?.isActive ?? true,
			sortOrder: 50,
		})
		.returning();
	return category;
}

export async function addToGuestCart(input: {
	productVariantId: string;
	quantity?: number;
	cookie?: string | null;
}) {
	const res = await api("/cart/items", {
		method: "POST",
		headers: input.cookie ? { cookie: input.cookie } : undefined,
		body: JSON.stringify({
			productVariantId: input.productVariantId,
			quantity: input.quantity ?? 1,
		}),
	});
	const cartCookie =
		cartSessionFromResponse(res) ??
		(input.cookie?.split(";").find((part) => part.trim().startsWith(`${CART_SESSION_COOKIE}=`))
			?.trim() ??
			null);
	const sessionId = cartCookie?.split("=")[1] ?? null;
	return { res, cartCookie, sessionId };
}

export async function ensureTestShippingMethod() {
	const db = testDb();
	const [existing] = await db
		.select()
		.from(shippingMethods)
		.where(eq(shippingMethods.name, TEST_SHIPPING_NAME))
		.limit(1);
	if (existing) {
		return existing;
	}

	const [created] = await db
		.insert(shippingMethods)
		.values({
			name: TEST_SHIPPING_NAME,
			description: "Fixture shipping for ecommerce-api tests",
			price: 499,
			currency: "EUR",
			estimatedMinDays: 2,
			estimatedMaxDays: 5,
			isActive: true,
			sortOrder: 99,
		})
		.returning();
	return created;
}

export async function ensureTestCoupon() {
	const db = testDb();
	const [existing] = await db
		.select()
		.from(coupons)
		.where(eq(coupons.code, TEST_COUPON_CODE))
		.limit(1);
	if (existing) {
		return existing;
	}

	const [created] = await db
		.insert(coupons)
		.values({
			code: TEST_COUPON_CODE,
			type: "percentage",
			value: 10,
			minOrderAmount: 2_000,
			maxDiscountAmount: 1_500,
			isActive: true,
		})
		.returning();
	return created;
}

export async function seedTestCoupon(input?: {
	code?: string;
	minOrderAmount?: number | null;
	expiresAt?: Date | null;
	startsAt?: Date | null;
	value?: number;
	isActive?: boolean;
}) {
	const db = testDb();
	const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
	const [created] = await db
		.insert(coupons)
		.values({
			code: input?.code ?? `${TEST_COUPON_PREFIX}${suffix}`,
			type: "percentage",
			value: input?.value ?? 10,
			minOrderAmount:
				input?.minOrderAmount === undefined ? 2_000 : input.minOrderAmount,
			maxDiscountAmount: 1_500,
			startsAt: input?.startsAt ?? null,
			expiresAt: input?.expiresAt ?? null,
			isActive: input?.isActive ?? true,
		})
		.returning();
	return created;
}

export function testAddress(overrides: Record<string, string> = {}) {
	return {
		firstName: "Test",
		lastName: "Buyer",
		addressLine1: "12 Test Street",
		city: "Dublin",
		state: "Leinster",
		postalCode: "D02",
		country: "IE",
		...overrides,
	};
}

export async function cleanupEcommerceFixtures(input?: {
	userIds?: string[];
	productIds?: string[];
	categoryIds?: string[];
	cartSessionIds?: string[];
	orderEmails?: string[];
}) {
	const db = testDb();
	const userIds = [...(input?.userIds ?? [])];
	const productIds = [...(input?.productIds ?? [])];
	const categoryIds = [...(input?.categoryIds ?? [])];
	const cartSessionIds = [...(input?.cartSessionIds ?? [])];
	const orderEmails = [...(input?.orderEmails ?? [])];

	const prefixedProducts = await db
		.select({ id: products.id })
		.from(products)
		.where(like(products.slug, `${TEST_SLUG_PREFIX}%`));
	for (const row of prefixedProducts) {
		if (!productIds.includes(row.id)) {
			productIds.push(row.id);
		}
	}

	const prefixedCategories = await db
		.select({ id: categories.id })
		.from(categories)
		.where(like(categories.slug, `${TEST_SLUG_PREFIX}%`));
	for (const row of prefixedCategories) {
		if (!categoryIds.includes(row.id)) {
			categoryIds.push(row.id);
		}
	}

	const testUsers = await db
		.select()
		.from(user)
		.where(like(user.email, `%@${TEST_EMAIL_DOMAIN}`));
	for (const row of testUsers) {
		if (!userIds.includes(row.id)) {
			userIds.push(row.id);
		}
		if (!orderEmails.includes(row.email)) {
			orderEmails.push(row.email);
		}
	}

	const domainOrders = await db
		.select({ id: orders.id, customerEmail: orders.customerEmail })
		.from(orders)
		.where(like(orders.customerEmail, `%@${TEST_EMAIL_DOMAIN}`));
	const orderIds = new Set(domainOrders.map((row) => row.id));
	if (orderEmails.length) {
		const namedOrders = await db
			.select({ id: orders.id })
			.from(orders)
			.where(inArray(orders.customerEmail, orderEmails));
		for (const row of namedOrders) {
			orderIds.add(row.id);
		}
	}
	if (orderIds.size) {
		const ids = [...orderIds];
		await db.delete(payments).where(inArray(payments.orderId, ids));
		await db.delete(orderItems).where(inArray(orderItems.orderId, ids));
		await db.delete(orders).where(inArray(orders.id, ids));
	}

	if (productIds.length) {
		const variants = await db
			.select({ id: productVariants.id })
			.from(productVariants)
			.where(inArray(productVariants.productId, productIds));
		const variantIds = variants.map((row) => row.id);
		if (variantIds.length) {
			await db
				.delete(cartItems)
				.where(inArray(cartItems.productVariantId, variantIds));
		}
		await db
			.delete(productCategories)
			.where(inArray(productCategories.productId, productIds));
		await db.delete(products).where(inArray(products.id, productIds));
	}

	if (categoryIds.length) {
		await db
			.delete(productCategories)
			.where(inArray(productCategories.categoryId, categoryIds));
		await db.delete(categories).where(inArray(categories.id, categoryIds));
	}

	if (cartSessionIds.length) {
		await db.delete(carts).where(inArray(carts.sessionId, cartSessionIds));
	}

	for (const userId of userIds) {
		await db.delete(session).where(eq(session.userId, userId));
		await db.delete(account).where(eq(account.userId, userId));
		await db.delete(user).where(eq(user.id, userId));
	}

	await db.delete(coupons).where(like(coupons.code, `${TEST_COUPON_PREFIX}%`));
}
