import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type { DB } from "@/db/db.js";
import {
	categories,
	orders,
	productCategories,
	products,
	productVariants,
} from "@/db/schema.js";
import type { AppRouteHandler } from "@/lib/types.js";
import { loadOrderView } from "@/services/checkout.js";
import type {
	CreateAdminCategoryRoute,
	CreateAdminProductRoute,
	CreateAdminVariantRoute,
	DeleteAdminCategoryRoute,
	DeleteAdminProductRoute,
	DeleteAdminVariantRoute,
	GetAdminOrderRoute,
	GetAdminProductRoute,
	ListAdminCategoriesRoute,
	ListAdminOrdersRoute,
	ListAdminProductsRoute,
	UpdateAdminCategoryRoute,
	UpdateAdminOrderRoute,
	UpdateAdminProductRoute,
	UpdateAdminVariantRoute,
} from "./admin.routes.js";
import {
	adminListQuerySchema,
	adminOrdersQuerySchema,
	insertCategorySchema,
	insertProductSchema,
	insertVariantSchema,
	updateCategorySchema,
	updateOrderStatusSchema,
	updateProductSchema,
	updateVariantSchema,
} from "./admin.schemas.js";

const idParams = (param: Record<string, string>) => {
	const id = param.id;
	if (!id) {
		throw new Error("Missing id");
	}
	return id;
};

async function setProductCategories(
	db: DB,
	productId: string,
	categoryIds: string[],
) {
	await db
		.delete(productCategories)
		.where(eq(productCategories.productId, productId));
	if (categoryIds.length === 0) {
		return;
	}
	await db
		.insert(productCategories)
		.values(categoryIds.map((categoryId) => ({ productId, categoryId })));
}

async function loadAdminProduct(db: DB, productId: string) {
	const [product] = await db
		.select()
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);
	if (!product) {
		return null;
	}

	const variants = await db
		.select()
		.from(productVariants)
		.where(eq(productVariants.productId, productId));

	const links = await db
		.select({ categoryId: productCategories.categoryId })
		.from(productCategories)
		.where(eq(productCategories.productId, productId));

	return {
		...product,
		variants,
		categoryIds: links.map((link) => link.categoryId),
	};
}

export const listAdminCategories: AppRouteHandler<
	ListAdminCategoriesRoute
> = async (c) => {
	const rows = await c.var.db
		.select()
		.from(categories)
		.orderBy(categories.sortOrder, categories.name);
	return c.json(rows, HttpStatusCodes.OK);
};

export const createAdminCategory: AppRouteHandler<
	CreateAdminCategoryRoute
> = async (c) => {
	const body = insertCategorySchema.parse(await c.req.json());
	const [row] = await c.var.db.insert(categories).values(body).returning();
	return c.json(row, HttpStatusCodes.CREATED);
};

export const updateAdminCategory: AppRouteHandler<
	UpdateAdminCategoryRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const body = updateCategorySchema.parse(await c.req.json());
	const [row] = await c.var.db
		.update(categories)
		.set(body)
		.where(eq(categories.id, id))
		.returning();
	if (!row) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(row, HttpStatusCodes.OK);
};

export const deleteAdminCategory: AppRouteHandler<
	DeleteAdminCategoryRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const deleted = await c.var.db
		.delete(categories)
		.where(eq(categories.id, id))
		.returning({ id: categories.id });
	if (deleted.length === 0) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const listAdminProducts: AppRouteHandler<
	ListAdminProductsRoute
> = async (c) => {
	const query = adminListQuerySchema.parse(c.req.query());
	const filters: SQL[] = [];
	if (query.status) {
		filters.push(eq(products.status, query.status));
	}
	if (query.q) {
		const term = `%${query.q}%`;
		filters.push(
			or(ilike(products.name, term), ilike(products.slug, term))!,
		);
	}
	const where = filters.length > 0 ? and(...filters) : undefined;

	const [totalRow] = await c.var.db
		.select({ total: count() })
		.from(products)
		.where(where);

	const rows = await c.var.db
		.select()
		.from(products)
		.where(where)
		.orderBy(desc(products.createdAt))
		.limit(query.limit)
		.offset(query.offset);

	const items = [];
	for (const product of rows) {
		const full = await loadAdminProduct(c.var.db, product.id);
		if (full) {
			items.push(full);
		}
	}

	return c.json(
		{
			items,
			total: totalRow?.total ?? 0,
			limit: query.limit,
			offset: query.offset,
		},
		HttpStatusCodes.OK,
	);
};

export const getAdminProduct: AppRouteHandler<GetAdminProductRoute> = async (
	c,
) => {
	const id = idParams(c.req.param());
	const product = await loadAdminProduct(c.var.db, id);
	if (!product) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(product, HttpStatusCodes.OK);
};

export const createAdminProduct: AppRouteHandler<
	CreateAdminProductRoute
> = async (c) => {
	const body = insertProductSchema.parse(await c.req.json());
	const { categoryIds, ...productData } = body;
	const [product] = await c.var.db
		.insert(products)
		.values(productData)
		.returning();
	await setProductCategories(c.var.db, product.id, categoryIds);
	const full = await loadAdminProduct(c.var.db, product.id);
	if (!full) {
		throw new Error("Product missing after create");
	}
	return c.json(full, HttpStatusCodes.CREATED);
};

export const updateAdminProduct: AppRouteHandler<
	UpdateAdminProductRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const body = updateProductSchema.parse(await c.req.json());
	const { categoryIds, ...productData } = body;

	if (Object.keys(productData).length > 0) {
		const [updated] = await c.var.db
			.update(products)
			.set(productData)
			.where(eq(products.id, id))
			.returning();
		if (!updated) {
			return c.json(
				{ message: HttpStatusPhrases.NOT_FOUND },
				HttpStatusCodes.NOT_FOUND,
			);
		}
	} else {
		const [existing] = await c.var.db
			.select({ id: products.id })
			.from(products)
			.where(eq(products.id, id))
			.limit(1);
		if (!existing) {
			return c.json(
				{ message: HttpStatusPhrases.NOT_FOUND },
				HttpStatusCodes.NOT_FOUND,
			);
		}
	}

	if (categoryIds) {
		await setProductCategories(c.var.db, id, categoryIds);
	}

	const full = await loadAdminProduct(c.var.db, id);
	if (!full) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(full, HttpStatusCodes.OK);
};

export const deleteAdminProduct: AppRouteHandler<
	DeleteAdminProductRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const deleted = await c.var.db
		.delete(products)
		.where(eq(products.id, id))
		.returning({ id: products.id });
	if (deleted.length === 0) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const createAdminVariant: AppRouteHandler<
	CreateAdminVariantRoute
> = async (c) => {
	const productId = idParams(c.req.param());
	const body = insertVariantSchema.parse(await c.req.json());

	const [product] = await c.var.db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);
	if (!product) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const [variant] = await c.var.db
		.insert(productVariants)
		.values({ ...body, productId })
		.returning();
	return c.json(variant, HttpStatusCodes.CREATED);
};

export const updateAdminVariant: AppRouteHandler<
	UpdateAdminVariantRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const body = updateVariantSchema.parse(await c.req.json());
	const [variant] = await c.var.db
		.update(productVariants)
		.set(body)
		.where(eq(productVariants.id, id))
		.returning();
	if (!variant) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(variant, HttpStatusCodes.OK);
};

export const deleteAdminVariant: AppRouteHandler<
	DeleteAdminVariantRoute
> = async (c) => {
	const id = idParams(c.req.param());
	const deleted = await c.var.db
		.delete(productVariants)
		.where(eq(productVariants.id, id))
		.returning({ id: productVariants.id });
	if (deleted.length === 0) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const listAdminOrders: AppRouteHandler<ListAdminOrdersRoute> = async (
	c,
) => {
	const query = adminOrdersQuerySchema.parse(c.req.query());
	const filters: SQL[] = [];
	if (query.status) {
		filters.push(eq(orders.status, query.status));
	}
	if (query.q) {
		const term = `%${query.q}%`;
		filters.push(
			or(ilike(orders.orderNumber, term), ilike(orders.customerEmail, term))!,
		);
	}
	const where = filters.length > 0 ? and(...filters) : undefined;

	const [totalRow] = await c.var.db
		.select({ total: count() })
		.from(orders)
		.where(where);

	const rows = await c.var.db
		.select({ id: orders.id })
		.from(orders)
		.where(where)
		.orderBy(desc(orders.createdAt))
		.limit(query.limit)
		.offset(query.offset);

	const items = [];
	for (const row of rows) {
		const order = await loadOrderView(c.var.db, row.id);
		if (order) {
			items.push(order);
		}
	}

	return c.json(
		{
			items,
			total: totalRow?.total ?? 0,
			limit: query.limit,
			offset: query.offset,
		},
		HttpStatusCodes.OK,
	);
};

export const getAdminOrder: AppRouteHandler<GetAdminOrderRoute> = async (c) => {
	const id = idParams(c.req.param());
	const order = await loadOrderView(c.var.db, id);
	if (!order) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(order, HttpStatusCodes.OK);
};

export const updateAdminOrder: AppRouteHandler<UpdateAdminOrderRoute> = async (
	c,
) => {
	const id = idParams(c.req.param());
	const body = updateOrderStatusSchema.parse(await c.req.json());

	if (Object.keys(body).length === 0) {
		const order = await loadOrderView(c.var.db, id);
		if (!order) {
			return c.json(
				{ message: HttpStatusPhrases.NOT_FOUND },
				HttpStatusCodes.NOT_FOUND,
			);
		}
		return c.json(order, HttpStatusCodes.OK);
	}

	const [updated] = await c.var.db
		.update(orders)
		.set(body)
		.where(eq(orders.id, id))
		.returning({ id: orders.id });

	if (!updated) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	const order = await loadOrderView(c.var.db, id);
	if (!order) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}
	return c.json(order, HttpStatusCodes.OK);
};
