import { structuredLogger } from "@hono/structured-logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import pino from "pino";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import env from "../env.js";
import type { AppBindings } from "./types.js";

const rootLogger = pino({
	level: env.LOG_LEVEL,
	transport: {
		target: "pino-pretty",
	},
});

export function createRouter() {
	return new OpenAPIHono<AppBindings>({
		strict: false,
		defaultHook,
	});
}

export function createApp() {
	const app = createRouter();

	app.use(serveEmojiFavicon(""));
	app.use(requestId());
	app.use(
		structuredLogger({
			createLogger: (c) => rootLogger.child({ requestId: c.var.requestId }),
		}),
	);

	app.notFound(notFound);
	app.onError(onError);

	return app;
}
