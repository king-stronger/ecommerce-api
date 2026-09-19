import { createRoute, type RouteConfig } from "@hono/zod-openapi"
import type { Context, Next } from "hono";

import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

import env from "../env.js";
import { createAuth } from "../lib/auth.js";
import type { AppBindings } from "../lib/types.js";

export const authMiddleware = async(c: Context<AppBindings>, next: Next) => {
    const auth = createAuth(env)
    const session = await auth.api.getSession({
        headers: c.req.raw.headers
    })

    if(!session){
        c.set("user", null);
        c.set("session", null);
        await next()
        return
    }

    c.set("user", session.user)
    c.set("session", session.session)
    await next();
}

export const requireAuth = async(c: Context<AppBindings>, next: Next) => {
    const user = c.get("user")

    if(!user){
        return c.json(
            {
                message: HttpStatusPhrases.UNAUTHORIZED
            },
            HttpStatusCodes.UNAUTHORIZED
        )
    }

    await next()
}

export const protectedRoute = <
    R extends Omit<RouteConfig, "middleware" | "security">
>(
    options: R
) => 
    createRoute({
        ...options,
        middleware: [authMiddleware, requireAuth] as const,
        security: [{ CookieAuth: [] }],
        responses: {
            [HttpStatusCodes.UNAUTHORIZED]: {
                description: "Unauthorized"
            },
            ...options.responses
        }
    })

export const optionalRoute = <
    R extends Omit<RouteConfig, "middleware" | "security">
>(
    options: R
) =>
    createRoute({
        ...options,
        middleware: [authMiddleware] as const,
        security: [{ CookieAuth: [] }],
        responses: options.responses
    })