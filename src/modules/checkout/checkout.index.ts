import { createRouter } from "@/lib/create-app.js";
import * as handlers from "./checkout.handlers.js";
import * as routes from "./checkout.routes.js";

const router = createRouter()
	.openapi(routes.listShippingMethods, handlers.listShippingMethods)
	.openapi(routes.createCheckout, handlers.createCheckout)
	.openapi(routes.getOrderByNumber, handlers.getOrderByNumber);

export default router;
