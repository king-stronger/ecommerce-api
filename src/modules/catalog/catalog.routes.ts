import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent } from "stoker/openapi/helpers";
import {
	createErrorSchema,
	createMessageObjectSchema,
} from "stoker/openapi/schemas";
import { optionalRoute } from "@/middlewares/auth.js";
import {
	listProductsQuerySchema,
	productWithVariantsSchema,
	selectCategorySchema,
	slugParamsSchema,
} from "./catalog.schemas.js";

const tags = ["Catalog"];

export const listCategories = optionalRoute({
	tags,
	path: "/categories",
	method: "get",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCategorySchema),
			"Active categories",
		),
	},
});

export const getCategoryBySlug = optionalRoute({
	tags,
	path: "/categories/{slug}",
	method: "get",
	request: {
		params: slugParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(selectCategorySchema, "Category"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Category not found",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(slugParamsSchema),
			"Invalid slug",
		),
	},
});

export const listProducts = optionalRoute({
	tags,
	path: "/products",
	method: "get",
	request: {
		query: listProductsQuerySchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(productWithVariantsSchema),
			"Active products",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(listProductsQuerySchema),
			"Invalid query",
		),
	},
});

export const getProductBySlug = optionalRoute({
	tags,
	path: "/products/{slug}",
	method: "get",
	request: {
		params: slugParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			productWithVariantsSchema,
			"Product with variants",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Product not found",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(slugParamsSchema),
			"Invalid slug",
		),
	},
});

export type ListCategoriesRoute = typeof listCategories;
export type GetCategoryBySlugRoute = typeof getCategoryBySlug;
export type ListProductsRoute = typeof listProducts;
export type GetProductBySlugRoute = typeof getProductBySlug;
