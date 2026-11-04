import { configureOpenApi } from "@/lib/configure-open-api.js";
import { createApp } from "@/lib/create-app.js";
import cart from "@/modules/cart/cart.index.js";
import catalog from "@/modules/catalog/catalog.index.js";

const app = createApp();

configureOpenApi(app);

const routes = [catalog, cart] as const;

for (const route of routes) {
	// OpenAPIHono route unions explode past TS limits once modules grow
	app.route("/", route as never);
}

export default app;
