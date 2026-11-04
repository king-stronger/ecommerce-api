import { createRouter } from "@/lib/create-app.js";
import * as handlers from "./admin.handlers.js";
import * as routes from "./admin.routes.js";

const router = createRouter()
	.openapi(routes.listAdminCategories, handlers.listAdminCategories)
	.openapi(routes.createAdminCategory, handlers.createAdminCategory)
	.openapi(routes.updateAdminCategory, handlers.updateAdminCategory)
	.openapi(routes.deleteAdminCategory, handlers.deleteAdminCategory)
	.openapi(routes.listAdminProducts, handlers.listAdminProducts)
	.openapi(routes.getAdminProduct, handlers.getAdminProduct)
	.openapi(routes.createAdminProduct, handlers.createAdminProduct)
	.openapi(routes.updateAdminProduct, handlers.updateAdminProduct)
	.openapi(routes.deleteAdminProduct, handlers.deleteAdminProduct)
	.openapi(routes.createAdminVariant, handlers.createAdminVariant)
	.openapi(routes.updateAdminVariant, handlers.updateAdminVariant)
	.openapi(routes.deleteAdminVariant, handlers.deleteAdminVariant)
	.openapi(routes.listAdminOrders, handlers.listAdminOrders)
	.openapi(routes.getAdminOrder, handlers.getAdminOrder)
	.openapi(routes.updateAdminOrder, handlers.updateAdminOrder);

export default router;
