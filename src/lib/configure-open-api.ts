import { Scalar } from "@scalar/hono-api-reference";
import type { AppOpenApi } from "@/lib/types.js";
import packageJson from "../../package.json" with { type: "json" };

export function configureOpenApi(app: AppOpenApi) {
	app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
		type: "apiKey",
		in: "cookie",
		name: "better-auth.session_token",
	});

	app.doc("/docs", {
		openapi: "3.2.0",
		info: {
			version: packageJson.version,
			title: "Ecommerce API",
		},
	});

	app.get(
		"/scalar",
		Scalar({
			sources: [
				{ url: "/docs", title: "API" },
				{ url: "/api/auth/open-api/generate-schema", title: "AUTH" },
			],
			theme: "kepler",
			layout: "modern",
			defaultHttpClient: {
				targetKey: "js",
				clientKey: "fetch",
			},
		}),
	);
}
