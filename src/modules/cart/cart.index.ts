import { createRouter } from "@/lib/create-app.js";
import * as handlers from "./cart.handlers.js";
import * as routes from "./cart.routes.js";

const router = createRouter()
	.openapi(routes.getCart, handlers.getCart)
	.openapi(routes.addCartItem, handlers.addCartItem)
	.openapi(routes.updateCartItem, handlers.updateCartItem)
	.openapi(routes.removeCartItem, handlers.removeCartItem)
	.openapi(routes.clearCart, handlers.clearCart);

export default router;
