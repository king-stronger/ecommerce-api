import { createRoute, type RouteConfig } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import type { AppBindings } from "@/lib/types.js";

function hasAdminRole(role: string | string[] | null | undefined) {
	if (!role) {
		return false;
	}
	const roles = Array.isArray(role) ? role : role.split(",");
	return roles.map((value) => value.trim()).includes("admin");
}

export const authMiddleware = async (c: Context<AppBindings>, next: Next) => {
	const session = await c.var.auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		c.set("user", null);
		c.set("session", null);
		await next();
		return;
	}

	c.set("user", session.user);
	c.set("session", session.session);
	await next();
};

export const requireAuth = async (c: Context<AppBindings>, next: Next) => {
	if (!c.get("user")) {
		return c.json(
			{ message: HttpStatusPhrases.UNAUTHORIZED },
			HttpStatusCodes.UNAUTHORIZED,
		);
	}
	await next();
};

export const requireAdmin = async (c: Context<AppBindings>, next: Next) => {
	const user = c.get("user");
	if (!user || !hasAdminRole(user.role)) {
		return c.json(
			{ message: HttpStatusPhrases.FORBIDDEN },
			HttpStatusCodes.FORBIDDEN,
		);
	}
	await next();
};

export const protectedRoute = <
	R extends Omit<RouteConfig, "middleware" | "security">,
>(
	options: R,
) =>
	createRoute({
		...options,
		middleware: [authMiddleware, requireAuth] as const,
		security: [{ cookieAuth: [] }],
		responses: {
			[HttpStatusCodes.UNAUTHORIZED]: {
				description: "Unauthorized",
			},
			...options.responses,
		},
	});

export const optionalRoute = <
	R extends Omit<RouteConfig, "middleware" | "security">,
>(
	options: R,
) =>
	createRoute({
		...options,
		middleware: [authMiddleware] as const,
		security: [{ cookieAuth: [] }],
		responses: options.responses,
	});

export const adminRoute = <
	R extends Omit<RouteConfig, "middleware" | "security">,
>(
	options: R,
) =>
	createRoute({
		...options,
		middleware: [authMiddleware, requireAuth, requireAdmin] as const,
		security: [{ cookieAuth: [] }],
		responses: {
			[HttpStatusCodes.UNAUTHORIZED]: {
				description: "Unauthorized",
			},
			[HttpStatusCodes.FORBIDDEN]: {
				description: "Forbidden",
			},
			...options.responses,
		},
	});
