import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
	createErrorSchema,
	createMessageObjectSchema,
	IdUUIDParamsSchema,
} from "stoker/openapi/schemas";
import { adminRoute } from "@/middlewares/auth.js";
import {
	adminListQuerySchema,
	insertCategorySchema,
	insertProductSchema,
	insertVariantSchema,
	orderViewSchema,
	productWithVariantsSchema,
	selectCategorySchema,
	selectProductVariantSchema,
	updateCategorySchema,
	updateOrderStatusSchema,
	updateProductSchema,
	updateVariantSchema,
} from "./admin.schemas.js";

const tags = ["Admin"];

const notFound = jsonContent(
	createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
	"Not found",
);

export const listAdminCategories = adminRoute({
	tags,
	path: "/admin/categories",
	method: "get",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCategorySchema),
			"All categories",
		),
	},
});

export const createAdminCategory = adminRoute({
	tags,
	path: "/admin/categories",
	method: "post",
	request: {
		body: jsonContentRequired(insertCategorySchema, "Category to create"),
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(
			selectCategorySchema,
			"Category created",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(insertCategorySchema),
			"Validation error(s)",
		),
	},
});

export const updateAdminCategory = adminRoute({
	tags,
	path: "/admin/categories/{id}",
	method: "patch",
	request: {
		params: IdUUIDParamsSchema,
		body: jsonContentRequired(updateCategorySchema, "Category patch"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(selectCategorySchema, "Category updated"),
		[HttpStatusCodes.NOT_FOUND]: notFound,
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(updateCategorySchema),
			"Validation error(s)",
		),
	},
});

export const deleteAdminCategory = adminRoute({
	tags,
	path: "/admin/categories/{id}",
	method: "delete",
	request: { params: IdUUIDParamsSchema },
	responses: {
		[HttpStatusCodes.NO_CONTENT]: { description: "Category deleted" },
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const listAdminProducts = adminRoute({
	tags,
	path: "/admin/products",
	method: "get",
	request: { query: adminListQuerySchema },
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(productWithVariantsSchema),
			"Products",
		),
	},
});

export const getAdminProduct = adminRoute({
	tags,
	path: "/admin/products/{id}",
	method: "get",
	request: { params: IdUUIDParamsSchema },
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			productWithVariantsSchema,
			"Product with variants",
		),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const createAdminProduct = adminRoute({
	tags,
	path: "/admin/products",
	method: "post",
	request: {
		body: jsonContentRequired(insertProductSchema, "Product to create"),
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(
			productWithVariantsSchema,
			"Product created",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(insertProductSchema),
			"Validation error(s)",
		),
	},
});

export const updateAdminProduct = adminRoute({
	tags,
	path: "/admin/products/{id}",
	method: "patch",
	request: {
		params: IdUUIDParamsSchema,
		body: jsonContentRequired(updateProductSchema, "Product patch"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			productWithVariantsSchema,
			"Product updated",
		),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const deleteAdminProduct = adminRoute({
	tags,
	path: "/admin/products/{id}",
	method: "delete",
	request: { params: IdUUIDParamsSchema },
	responses: {
		[HttpStatusCodes.NO_CONTENT]: { description: "Product deleted" },
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const createAdminVariant = adminRoute({
	tags,
	path: "/admin/products/{id}/variants",
	method: "post",
	request: {
		params: IdUUIDParamsSchema,
		body: jsonContentRequired(insertVariantSchema, "Variant to create"),
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(
			selectProductVariantSchema,
			"Variant created",
		),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const updateAdminVariant = adminRoute({
	tags,
	path: "/admin/variants/{id}",
	method: "patch",
	request: {
		params: IdUUIDParamsSchema,
		body: jsonContentRequired(updateVariantSchema, "Variant patch"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectProductVariantSchema,
			"Variant updated",
		),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const deleteAdminVariant = adminRoute({
	tags,
	path: "/admin/variants/{id}",
	method: "delete",
	request: { params: IdUUIDParamsSchema },
	responses: {
		[HttpStatusCodes.NO_CONTENT]: { description: "Variant deleted" },
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const listAdminOrders = adminRoute({
	tags,
	path: "/admin/orders",
	method: "get",
	request: { query: adminListQuerySchema.omit({ status: true }) },
	responses: {
		[HttpStatusCodes.OK]: jsonContent(z.array(orderViewSchema), "Orders"),
	},
});

export const getAdminOrder = adminRoute({
	tags,
	path: "/admin/orders/{id}",
	method: "get",
	request: { params: IdUUIDParamsSchema },
	responses: {
		[HttpStatusCodes.OK]: jsonContent(orderViewSchema, "Order"),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export const updateAdminOrder = adminRoute({
	tags,
	path: "/admin/orders/{id}",
	method: "patch",
	request: {
		params: IdUUIDParamsSchema,
		body: jsonContentRequired(updateOrderStatusSchema, "Order status patch"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(orderViewSchema, "Order updated"),
		[HttpStatusCodes.NOT_FOUND]: notFound,
	},
});

export type ListAdminCategoriesRoute = typeof listAdminCategories;
export type CreateAdminCategoryRoute = typeof createAdminCategory;
export type UpdateAdminCategoryRoute = typeof updateAdminCategory;
export type DeleteAdminCategoryRoute = typeof deleteAdminCategory;
export type ListAdminProductsRoute = typeof listAdminProducts;
export type GetAdminProductRoute = typeof getAdminProduct;
export type CreateAdminProductRoute = typeof createAdminProduct;
export type UpdateAdminProductRoute = typeof updateAdminProduct;
export type DeleteAdminProductRoute = typeof deleteAdminProduct;
export type CreateAdminVariantRoute = typeof createAdminVariant;
export type UpdateAdminVariantRoute = typeof updateAdminVariant;
export type DeleteAdminVariantRoute = typeof deleteAdminVariant;
export type ListAdminOrdersRoute = typeof listAdminOrders;
export type GetAdminOrderRoute = typeof getAdminOrder;
export type UpdateAdminOrderRoute = typeof updateAdminOrder;
