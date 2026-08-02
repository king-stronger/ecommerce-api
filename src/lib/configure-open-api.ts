import { Scalar } from "@scalar/hono-api-reference";
import packageJson from "../../package.json" with { type: "json" };
import type { AppOpenApi } from "./types.js";

export function configureOpenApi(app: AppOpenApi) {
	app.doc("/doc", {
		openapi: "3.2.0",
		info: {
			version: packageJson.version,
			title: "Garden Grid Api",
		},
	});

	app.get(
		"/scalar",
		Scalar({
			url: "/doc",
			theme: "kepler",
			layout: "modern",
			defaultHttpClient: {
				targetKey: "js",
				clientKey: "fetch",
			},
		}),
	);
}
