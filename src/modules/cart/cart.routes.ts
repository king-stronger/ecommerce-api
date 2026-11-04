import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
	createErrorSchema,
	createMessageObjectSchema,
} from "stoker/openapi/schemas";
import { optionalRoute } from "@/middlewares/auth.js";
import {
	addCartItemSchema,
	cartItemIdParamsSchema,
	cartViewSchema,
	updateCartItemSchema,
} from "./cart.schemas.js";

const tags = ["Cart"];

export const getCart = optionalRoute({
	tags,
	path: "/cart",
	method: "get",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(cartViewSchema, "Current guest cart"),
	},
});

export const addCartItem = optionalRoute({
	tags,
	path: "/cart/items",
	method: "post",
	request: {
		body: jsonContentRequired(addCartItemSchema, "Line to add"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(cartViewSchema, "Updated cart"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Variant not found or not sellable",
		),
		[HttpStatusCodes.CONFLICT]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.CONFLICT),
			"Insufficient stock",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(addCartItemSchema),
			"Validation error(s)",
		),
	},
});

export const updateCartItem = optionalRoute({
	tags,
	path: "/cart/items/{id}",
	method: "patch",
	request: {
		params: cartItemIdParamsSchema,
		body: jsonContentRequired(updateCartItemSchema, "Updated quantity"),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(cartViewSchema, "Updated cart"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Cart item not found",
		),
		[HttpStatusCodes.CONFLICT]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.CONFLICT),
			"Insufficient stock",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(updateCartItemSchema),
			"Validation error(s)",
		),
	},
});

export const removeCartItem = optionalRoute({
	tags,
	path: "/cart/items/{id}",
	method: "delete",
	request: {
		params: cartItemIdParamsSchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(cartViewSchema, "Updated cart"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Cart item not found",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(cartItemIdParamsSchema),
			"Invalid ID",
		),
	},
});

export const clearCart = optionalRoute({
	tags,
	path: "/cart",
	method: "delete",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(cartViewSchema, "Empty cart"),
	},
});

export type GetCartRoute = typeof getCart;
export type AddCartItemRoute = typeof addCartItem;
export type UpdateCartItemRoute = typeof updateCartItem;
export type RemoveCartItemRoute = typeof removeCartItem;
export type ClearCartRoute = typeof clearCart;
