import { configureOpenApi } from "@/lib/configure-open-api.js";
import { createApp } from "@/lib/create-app.js";

const app = createApp();

configureOpenApi(app);

const routes = [] as const;

for (const route of routes) {
	// OpenAPIHono route unions explode past TS limits once modules grow
	app.route("/", route as never);
}

export default app;
