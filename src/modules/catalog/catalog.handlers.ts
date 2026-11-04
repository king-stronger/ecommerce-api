import { and, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import {
	categories,
	productCategories,
	products,
	productVariants,
} from "@/db/schema.js";
import type { AppRouteHandler } from "@/lib/types.js";
import type {
	GetCategoryBySlugRoute,
	GetProductBySlugRoute,
	ListCategoriesRoute,
	ListProductsRoute,
} from "./catalog.routes.js";
import {
	listProductsQuerySchema,
	slugParamsSchema,
} from "./catalog.schemas.js";

export const listCategories: AppRouteHandler<ListCategoriesRoute> = async (
	c,
) => {
	const rows = await c.var.db
		.select()
		.from(categories)
		.where(eq(categories.isActive, true))
		.orderBy(categories.sortOrder, categories.name);

	return c.json(rows, HttpStatusCodes.OK);
};

export const getCategoryBySlug: AppRouteHandler<
	GetCategoryBySlugRoute
> = async (c) => {
	const { slug } = slugParamsSchema.parse(c.req.param());
	const [category] = await c.var.db
		.select()
		.from(categories)
		.where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
		.limit(1);

	if (!category) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(category, HttpStatusCodes.OK);
};

export const listProducts: AppRouteHandler<ListProductsRoute> = async (c) => {
	const { categorySlug, limit, offset } = listProductsQuerySchema.parse(
		c.req.query(),
	);
	const db = c.var.db;

	let productIdFilter: string[] | null = null;

	if (categorySlug) {
		const [category] = await db
			.select({ id: categories.id })
			.from(categories)
			.where(
				and(eq(categories.slug, categorySlug), eq(categories.isActive, true)),
			)
			.limit(1);

		if (!category) {
			return c.json([], HttpStatusCodes.OK);
		}

		const links = await db
			.select({ productId: productCategories.productId })
			.from(productCategories)
			.where(eq(productCategories.categoryId, category.id));

		productIdFilter = links.map((link) => link.productId);
		if (productIdFilter.length === 0) {
			return c.json([], HttpStatusCodes.OK);
		}
	}

	const productRows = await db
		.select()
		.from(products)
		.where(
			productIdFilter
				? and(
						eq(products.status, "active"),
						inArray(products.id, productIdFilter),
					)
				: eq(products.status, "active"),
		)
		.orderBy(products.name)
		.limit(limit)
		.offset(offset);

	if (productRows.length === 0) {
		return c.json([], HttpStatusCodes.OK);
	}

	const variants = await db
		.select()
		.from(productVariants)
		.where(
			and(
				inArray(
					productVariants.productId,
					productRows.map((product) => product.id),
				),
				eq(productVariants.isActive, true),
			),
		);

	const variantsByProduct = new Map<string, typeof variants>();
	for (const variant of variants) {
		const list = variantsByProduct.get(variant.productId) ?? [];
		list.push(variant);
		variantsByProduct.set(variant.productId, list);
	}

	return c.json(
		productRows.map((product) => ({
			...product,
			variants: variantsByProduct.get(product.id) ?? [],
		})),
		HttpStatusCodes.OK,
	);
};

export const getProductBySlug: AppRouteHandler<GetProductBySlugRoute> = async (
	c,
) => {
	const { slug } = slugParamsSchema.parse(c.req.param());
	const db = c.var.db;

	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.slug, slug), eq(products.status, "active")))
		.limit(1);

	if (!product) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const variants = await db
		.select()
		.from(productVariants)
		.where(
			and(
				eq(productVariants.productId, product.id),
				eq(productVariants.isActive, true),
			),
		);

	return c.json({ ...product, variants }, HttpStatusCodes.OK);
};
