import { createRouter } from "@/lib/create-app.js";
import * as handlers from "./catalog.handlers.js";
import * as routes from "./catalog.routes.js";

const router = createRouter()
	.openapi(routes.listCategories, handlers.listCategories)
	.openapi(routes.getCategoryBySlug, handlers.getCategoryBySlug)
	.openapi(routes.listProducts, handlers.listProducts)
	.openapi(routes.getProductBySlug, handlers.getProductBySlug);

export default router;
