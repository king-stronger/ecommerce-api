import { structuredLogger } from "@hono/structured-logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import type { AppBindings } from "@/lib/types.js";
import { services } from "@/middlewares/services.js";

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});
}

export function createApp() {
	const app = createRouter();

	app.use(serveEmojiFavicon("🛒"));
	app.use(requestId());
	app.use(
		structuredLogger({
			createLogger: (c) => ({
				debug: (...args: unknown[]) => console.debug(c.var.requestId, ...args),
				info: (...args: unknown[]) => console.info(c.var.requestId, ...args),
				warn: (...args: unknown[]) => console.warn(c.var.requestId, ...args),
				error: (...args: unknown[]) => console.error(c.var.requestId, ...args),
			}),
		}),
	);
	app.use(services);
	app.use(
		"*",
		cors({
			origin: (origin, c) => {
				const trusted = c.env.TRUSTED_ORIGINS.split(",")
					.map((value: string) => value.trim())
					.filter(Boolean);
				if (!origin) {
					return trusted[0] ?? "*";
				}
				return trusted.includes(origin) ? origin : null;
			},
			credentials: true,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		}),
	);

	app.on(["POST", "GET"], "/api/auth/*", (c) => {
		return c.var.auth.handler(c.req.raw);
	});

	app.notFound(notFound);
	app.onError(onError);

	return app;
}
