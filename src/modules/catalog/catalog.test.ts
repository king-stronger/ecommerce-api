import { afterEach, describe, expect, it } from "vitest";
import {
	TEST_SLUG_PREFIX,
	api,
	cleanupEcommerceFixtures,
	seedSellableProduct,
	seedTestCategory,
} from "@/test/helpers.js";

describe("catalog", () => {
	const fixtures: {
		productIds: string[];
		categoryIds: string[];
	} = { productIds: [], categoryIds: [] };

	afterEach(async () => {
		await cleanupEcommerceFixtures({
			productIds: fixtures.productIds,
			categoryIds: fixtures.categoryIds,
		});
		fixtures.productIds = [];
		fixtures.categoryIds = [];
	});

	it("lists active categories (smoke)", async () => {
		const res = await api("/categories");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			id: string;
			slug: string;
			isActive: boolean;
		}>;
		expect(Array.isArray(body)).toBe(true);
		expect(body.every((category) => category.isActive)).toBe(true);
	});

	it("returns a category by slug and 404s unknown ones", async () => {
		const category = await seedTestCategory();
		fixtures.categoryIds.push(category.id);

		const ok = await api(`/categories/${category.slug}`);
		expect(ok.status).toBe(200);
		const body = (await ok.json()) as { id: string; slug: string };
		expect(body.id).toBe(category.id);
		expect(body.slug).toBe(category.slug);

		const missing = await api(`/categories/${TEST_SLUG_PREFIX}missing-cat`);
		expect(missing.status).toBe(404);
	});

	it("hides inactive categories from public slug lookup", async () => {
		const category = await seedTestCategory({ isActive: false });
		fixtures.categoryIds.push(category.id);

		const res = await api(`/categories/${category.slug}`);
		expect(res.status).toBe(404);
	});

	it("lists an active product by slug with variants", async () => {
		const { product, variant } = await seedSellableProduct({
			name: "Catalog Tee",
			price: 2_500,
		});
		fixtures.productIds.push(product.id);

		const res = await api(`/products/${product.slug}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			id: string;
			slug: string;
			variants: Array<{ id: string; price: number }>;
		};
		expect(body.id).toBe(product.id);
		expect(body.variants.some((item) => item.id === variant.id)).toBe(true);
		expect(body.variants[0]?.price).toBe(2_500);
	});

	it("does not expose draft products on the public catalog", async () => {
		const { product } = await seedSellableProduct({ status: "draft" });
		fixtures.productIds.push(product.id);

		const bySlug = await api(`/products/${product.slug}`);
		expect(bySlug.status).toBe(404);

		const list = await api("/products");
		expect(list.status).toBe(200);
		const body = (await list.json()) as Array<{ id: string }>;
		expect(body.some((item) => item.id === product.id)).toBe(false);
	});

	it("filters products by categorySlug", async () => {
		const category = await seedTestCategory();
		fixtures.categoryIds.push(category.id);

		const linked = await seedSellableProduct({
			name: "Linked Product",
			categoryId: category.id,
		});
		const other = await seedSellableProduct({ name: "Other Product" });
		fixtures.productIds.push(linked.product.id, other.product.id);

		const res = await api(`/products?categorySlug=${category.slug}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.some((item) => item.id === linked.product.id)).toBe(true);
		expect(body.some((item) => item.id === other.product.id)).toBe(false);
	});

	it("returns an empty list for an unknown categorySlug", async () => {
		const res = await api(`/products?categorySlug=${TEST_SLUG_PREFIX}nope`);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});
});
