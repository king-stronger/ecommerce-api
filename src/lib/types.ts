import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Logger } from "pino";
import type { Auth } from "./auth.js";

export interface AppBindings {
	Variables: {
		logger: Logger;
		user: Auth["$Infer"]["Session"]["user"] | null;
		session: Auth["$Infer"]["Session"]["session"] | null;
	};
}

export type AppOpenApi = OpenAPIHono<AppBindings>;
