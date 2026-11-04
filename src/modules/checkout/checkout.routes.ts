import { z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
	createErrorSchema,
	createMessageObjectSchema,
} from "stoker/openapi/schemas";
import { optionalRoute } from "@/middlewares/auth.js";
import {
	checkoutRequestSchema,
	getOrderQuerySchema,
	orderNumberParamsSchema,
	orderViewSchema,
	selectShippingMethodSchema,
} from "./checkout.schemas.js";

const tags = ["Checkout"];

export const listShippingMethods = optionalRoute({
	tags,
	path: "/shipping-methods",
	method: "get",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectShippingMethodSchema),
			"Active shipping methods",
		),
	},
});

export const createCheckout = optionalRoute({
	tags,
	path: "/checkout",
	method: "post",
	request: {
		body: jsonContentRequired(checkoutRequestSchema, "Checkout payload"),
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(orderViewSchema, "Created order"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.BAD_REQUEST),
			"Cart empty or invalid checkout",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Shipping method or coupon not found",
		),
		[HttpStatusCodes.CONFLICT]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.CONFLICT),
			"Stock or coupon conflict",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(checkoutRequestSchema),
			"Validation error(s)",
		),
	},
});

export const getOrderByNumber = optionalRoute({
	tags,
	path: "/orders/{orderNumber}",
	method: "get",
	request: {
		params: orderNumberParamsSchema,
		query: getOrderQuerySchema,
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(orderViewSchema, "Order"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
			"Order not found",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(orderNumberParamsSchema),
			"Invalid params",
		),
	},
});

export type ListShippingMethodsRoute = typeof listShippingMethods;
export type CreateCheckoutRoute = typeof createCheckout;
export type GetOrderByNumberRoute = typeof getOrderByNumber;
