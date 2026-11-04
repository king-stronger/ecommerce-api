import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";
import type { DB } from "@/db/db.js";
import type { Auth } from "@/lib/auth.js";

export type Logger = Pick<Console, "debug" | "info" | "warn" | "error">;

export interface AppBindings {
	Bindings: Env;
	Variables: {
		logger: Logger;
		db: DB;
		auth: Auth;
		user: Auth["$Infer"]["Session"]["user"] | null;
		session: Auth["$Infer"]["Session"]["session"] | null;
	};
}

export type AppOpenApi = OpenAPIHono<AppBindings>;

export type AppRouteHandler<
	R extends RouteConfig,
	S extends Schema = Schema,
> = RouteHandler<R, AppBindings, S>;
