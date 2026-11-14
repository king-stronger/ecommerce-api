import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { categories, orders, productVariants, products } from "@/db/schema.js";
import {
	TEST_EMAIL_DOMAIN,
	TEST_SLUG_PREFIX,
	addToGuestCart,
	api,
	cleanupEcommerceFixtures,
	createTestUser,
	ensureTestShippingMethod,
	mergeCookies,
	seedSellableProduct,
	testAddress,
	testDb,
} from "@/test/helpers.js";

describe("admin", () => {
	const fixtures: {
		userIds: string[];
		productIds: string[];
		categoryIds: string[];
		cartSessionIds: string[];
		orderEmails: string[];
	} = {
		userIds: [],
		productIds: [],
		categoryIds: [],
		cartSessionIds: [],
		orderEmails: [],
	};

	afterEach(async () => {
		await cleanupEcommerceFixtures({
			userIds: fixtures.userIds,
			productIds: fixtures.productIds,
			categoryIds: fixtures.categoryIds,
			cartSessionIds: fixtures.cartSessionIds,
			orderEmails: fixtures.orderEmails,
		});
		fixtures.userIds = [];
		fixtures.productIds = [];
		fixtures.categoryIds = [];
		fixtures.cartSessionIds = [];
		fixtures.orderEmails = [];
	});

	it("rejects unauthenticated admin product listing", async () => {
		const res = await api("/admin/products");
		expect(res.status).toBe(401);
	});

	it("forbids non-admin users from listing products", async () => {
		const customer = await createTestUser({ name: "Customer Viewer" });
		fixtures.userIds.push(customer.id);

		const res = await api("/admin/products", {
			headers: { cookie: customer.cookie },
		});
		expect(res.status).toBe(403);
	});

	it("lets an admin create, list, update, and delete a product", async () => {
		const admin = await createTestUser({
			name: "Admin Editor",
			role: "admin",
		});
		fixtures.userIds.push(admin.id);

		const suffix = crypto.randomUUID().slice(0, 8);
		const slug = `${TEST_SLUG_PREFIX}admin-${suffix}`;

		const createRes = await api("/admin/products", {
			method: "POST",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				name: `Admin Fixture ${suffix}`,
				slug,
				status: "draft",
				shortDescription: "Created by admin test",
				images: [
					{
						url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
						alt: "Admin fixture",
						sort: 0,
					},
				],
			}),
		});
		expect(createRes.status).toBe(201);
		const created = (await createRes.json()) as {
			id: string;
			slug: string;
			status: string;
		};
		fixtures.productIds.push(created.id);
		expect(created.slug).toBe(slug);
		expect(created.status).toBe("draft");

		const patchRes = await api(`/admin/products/${created.id}`, {
			method: "PATCH",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				status: "active",
				name: `Admin Fixture Updated ${suffix}`,
			}),
		});
		expect(patchRes.status).toBe(200);
		const patched = (await patchRes.json()) as {
			id: string;
			name: string;
			status: string;
		};
		expect(patched.status).toBe("active");
		expect(patched.name).toContain("Updated");

		const listRes = await api(
			`/admin/products?status=active&q=${encodeURIComponent(slug)}`,
			{ headers: { cookie: admin.cookie } },
		);
		expect(listRes.status).toBe(200);
		const page = (await listRes.json()) as {
			items: Array<{ id: string; slug: string }>;
			total: number;
		};
		expect(page.total).toBeGreaterThanOrEqual(1);
		expect(page.items.some((item) => item.id === created.id)).toBe(true);

		const deleteRes = await api(`/admin/products/${created.id}`, {
			method: "DELETE",
			headers: { cookie: admin.cookie },
		});
		expect(deleteRes.status).toBe(204);
		fixtures.productIds = fixtures.productIds.filter((id) => id !== created.id);

		const db = testDb();
		const [remaining] = await db
			.select()
			.from(products)
			.where(eq(products.id, created.id))
			.limit(1);
		expect(remaining).toBeUndefined();
	});

	it("lets an admin manage product variants", async () => {
		const admin = await createTestUser({
			name: "Variant Admin",
			role: "admin",
		});
		fixtures.userIds.push(admin.id);

		const { product } = await seedSellableProduct();
		fixtures.productIds.push(product.id);

		const createVariant = await api(`/admin/products/${product.id}/variants`, {
			method: "POST",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				name: "Large",
				price: 6_500,
				stockQuantity: 4,
				trackInventory: true,
				isDefault: false,
				isActive: true,
			}),
		});
		expect(createVariant.status).toBe(201);
		const variant = (await createVariant.json()) as {
			id: string;
			name: string;
			price: number;
		};
		expect(variant.name).toBe("Large");
		expect(variant.price).toBe(6_500);

		const patchVariant = await api(`/admin/variants/${variant.id}`, {
			method: "PATCH",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({ price: 7_000, stockQuantity: 8 }),
		});
		expect(patchVariant.status).toBe(200);
		const patched = (await patchVariant.json()) as {
			price: number;
			stockQuantity: number;
		};
		expect(patched.price).toBe(7_000);
		expect(patched.stockQuantity).toBe(8);

		const deleteVariant = await api(`/admin/variants/${variant.id}`, {
			method: "DELETE",
			headers: { cookie: admin.cookie },
		});
		expect(deleteVariant.status).toBe(204);

		const db = testDb();
		const [remaining] = await db
			.select()
			.from(productVariants)
			.where(eq(productVariants.id, variant.id))
			.limit(1);
		expect(remaining).toBeUndefined();
	});

	it("lets an admin create, update, and delete a category", async () => {
		const admin = await createTestUser({
			name: "Admin Categories",
			role: "admin",
		});
		fixtures.userIds.push(admin.id);

		const suffix = crypto.randomUUID().slice(0, 8);
		const slug = `${TEST_SLUG_PREFIX}cat-${suffix}`;
		const createRes = await api("/admin/categories", {
			method: "POST",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				name: `Test Category ${suffix}`,
				slug,
				isActive: true,
			}),
		});
		expect(createRes.status).toBe(201);
		const category = (await createRes.json()) as { id: string; slug: string };
		fixtures.categoryIds.push(category.id);
		expect(category.slug).toBe(slug);

		const patchRes = await api(`/admin/categories/${category.id}`, {
			method: "PATCH",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({ name: `Renamed Category ${suffix}` }),
		});
		expect(patchRes.status).toBe(200);
		const patched = (await patchRes.json()) as { name: string };
		expect(patched.name).toContain("Renamed");

		const deleteRes = await api(`/admin/categories/${category.id}`, {
			method: "DELETE",
			headers: { cookie: admin.cookie },
		});
		expect(deleteRes.status).toBe(204);
		fixtures.categoryIds = fixtures.categoryIds.filter(
			(id) => id !== category.id,
		);

		const db = testDb();
		const [remaining] = await db
			.select()
			.from(categories)
			.where(eq(categories.id, category.id))
			.limit(1);
		expect(remaining).toBeUndefined();
	});

	it("lists admin categories and fetches a product by id", async () => {
		const admin = await createTestUser({
			name: "Lister Admin",
			role: "admin",
		});
		fixtures.userIds.push(admin.id);

		const suffix = crypto.randomUUID().slice(0, 8);
		const categoryRes = await api("/admin/categories", {
			method: "POST",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				name: `List Cat ${suffix}`,
				slug: `${TEST_SLUG_PREFIX}list-cat-${suffix}`,
				isActive: true,
			}),
		});
		expect(categoryRes.status).toBe(201);
		const category = (await categoryRes.json()) as { id: string; slug: string };
		fixtures.categoryIds.push(category.id);

		const listCats = await api("/admin/categories", {
			headers: { cookie: admin.cookie },
		});
		expect(listCats.status).toBe(200);
		const cats = (await listCats.json()) as Array<{ id: string }>;
		expect(cats.some((item) => item.id === category.id)).toBe(true);

		const productRes = await api("/admin/products", {
			method: "POST",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({
				name: `Detail Product ${suffix}`,
				slug: `${TEST_SLUG_PREFIX}detail-${suffix}`,
				status: "active",
				categoryIds: [category.id],
			}),
		});
		expect(productRes.status).toBe(201);
		const product = (await productRes.json()) as { id: string };
		fixtures.productIds.push(product.id);

		const getRes = await api(`/admin/products/${product.id}`, {
			headers: { cookie: admin.cookie },
		});
		expect(getRes.status).toBe(200);
		const detail = (await getRes.json()) as {
			id: string;
			categoryIds?: string[];
		};
		expect(detail.id).toBe(product.id);
		expect(detail.categoryIds?.includes(category.id)).toBe(true);

		const pageRes = await api("/admin/products?limit=1&offset=0&status=active", {
			headers: { cookie: admin.cookie },
		});
		expect(pageRes.status).toBe(200);
		const page = (await pageRes.json()) as {
			items: unknown[];
			limit: number;
			offset: number;
			total: number;
		};
		expect(page.limit).toBe(1);
		expect(page.offset).toBe(0);
		expect(page.items.length).toBeLessThanOrEqual(1);
		expect(page.total).toBeGreaterThanOrEqual(1);
	});

	it("lets an admin list and update order status", async () => {
		const admin = await createTestUser({
			name: "Orders Admin",
			role: "admin",
		});
		fixtures.userIds.push(admin.id);

		const { product, variant } = await seedSellableProduct({ price: 4_000 });
		fixtures.productIds.push(product.id);
		const shipping = await ensureTestShippingMethod();

		const added = await addToGuestCart({
			productVariantId: variant.id,
			quantity: 1,
		});
		expect(added.res.status).toBe(200);
		if (added.sessionId) {
			fixtures.cartSessionIds.push(added.sessionId);
		}

		const email = `admin-order-${crypto.randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
		fixtures.orderEmails.push(email);
		const address = testAddress();

		const checkoutRes = await api("/checkout", {
			method: "POST",
			headers: { cookie: mergeCookies(added.cartCookie) },
			body: JSON.stringify({
				customerEmail: email,
				customerFirstName: "Admin",
				shippingAddress: address,
				billingAddress: address,
				shippingMethodId: shipping.id,
				currency: "EUR",
			}),
		});
		expect(checkoutRes.status).toBe(201);
		const order = (await checkoutRes.json()) as {
			id: string;
			orderNumber: string;
			status: string;
		};

		const listRes = await api(
			`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`,
			{ headers: { cookie: admin.cookie } },
		);
		expect(listRes.status).toBe(200);
		const page = (await listRes.json()) as {
			items: Array<{ id: string; orderNumber: string }>;
			total: number;
		};
		expect(page.items.some((item) => item.id === order.id)).toBe(true);

		const getRes = await api(`/admin/orders/${order.id}`, {
			headers: { cookie: admin.cookie },
		});
		expect(getRes.status).toBe(200);
		const detail = (await getRes.json()) as {
			id: string;
			orderNumber: string;
			status: string;
		};
		expect(detail.id).toBe(order.id);
		expect(detail.orderNumber).toBe(order.orderNumber);

		const filtered = await api("/admin/orders?status=pending&limit=5&offset=0", {
			headers: { cookie: admin.cookie },
		});
		expect(filtered.status).toBe(200);
		const filteredPage = (await filtered.json()) as {
			items: Array<{ id: string; status: string }>;
			limit: number;
		};
		expect(filteredPage.limit).toBe(5);
		expect(
			filteredPage.items.every((item) => item.status === "pending"),
		).toBe(true);

		const patchRes = await api(`/admin/orders/${order.id}`, {
			method: "PATCH",
			headers: { cookie: admin.cookie },
			body: JSON.stringify({ status: "confirmed" }),
		});
		expect(patchRes.status).toBe(200);
		const patched = (await patchRes.json()) as { status: string };
		expect(patched.status).toBe("confirmed");

		const db = testDb();
		const [row] = await db
			.select()
			.from(orders)
			.where(eq(orders.id, order.id))
			.limit(1);
		expect(row?.status).toBe("confirmed");
	});
});
