import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Logger } from "pino";

export interface AppBindings {
	Variables: {
		logger: Logger;
	};
}

export type AppOpenApi = OpenAPIHono<AppBindings>;
