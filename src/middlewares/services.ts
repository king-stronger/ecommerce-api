import { createMiddleware } from "hono/factory";
import { createDb } from "@/db/db.js";
import { createAuth } from "@/lib/auth.js";
import { assertEnv } from "@/lib/env.js";
import type { AppBindings } from "@/lib/types.js";

export const services = createMiddleware<AppBindings>(async (c, next) => {
	assertEnv(c.env);
	const db = createDb(c.env);
	c.set("db", db);
	c.set("auth", createAuth(c.env, db));
	c.set("logger", console);
	await next();
});
