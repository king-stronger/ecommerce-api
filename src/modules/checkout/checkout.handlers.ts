import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type { AppRouteHandler } from "@/lib/types.js";
import {
	CheckoutError,
	createCheckoutOrder,
	findOrderByNumber,
	listActiveShippingMethods,
} from "@/services/checkout.js";
import type {
	CreateCheckoutRoute,
	GetOrderByNumberRoute,
	ListShippingMethodsRoute,
} from "./checkout.routes.js";
import {
	checkoutRequestSchema,
	getOrderQuerySchema,
	orderNumberParamsSchema,
} from "./checkout.schemas.js";

export const listShippingMethods: AppRouteHandler<
	ListShippingMethodsRoute
> = async (c) => {
	const rows = await listActiveShippingMethods(c.var.db);
	return c.json(rows, HttpStatusCodes.OK);
};

export const createCheckout: AppRouteHandler<CreateCheckoutRoute> = async (
	c,
) => {
	const body = checkoutRequestSchema.parse(await c.req.json());

	try {
		const order = await createCheckoutOrder(c, {
			...body,
			couponCode: body.couponCode?.trim(),
		});
		return c.json(order, HttpStatusCodes.CREATED);
	} catch (error) {
		if (error instanceof CheckoutError) {
			if (error.code === "NOT_FOUND") {
				return c.json(
					{ message: error.message || HttpStatusPhrases.NOT_FOUND },
					HttpStatusCodes.NOT_FOUND,
				);
			}
			if (error.code === "CONFLICT") {
				return c.json(
					{ message: error.message || HttpStatusPhrases.CONFLICT },
					HttpStatusCodes.CONFLICT,
				);
			}
			return c.json(
				{ message: error.message || HttpStatusPhrases.BAD_REQUEST },
				HttpStatusCodes.BAD_REQUEST,
			);
		}
		throw error;
	}
};

export const getOrderByNumber: AppRouteHandler<GetOrderByNumberRoute> = async (
	c,
) => {
	const { orderNumber } = orderNumberParamsSchema.parse(c.req.param());
	const { email } = getOrderQuerySchema.parse(c.req.query());
	const order = await findOrderByNumber(c.var.db, orderNumber);

	if (!order || order.customerEmail.toLowerCase() !== email.toLowerCase()) {
		return c.json(
			{ message: HttpStatusPhrases.NOT_FOUND },
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(order, HttpStatusCodes.OK);
};
