import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppBindings } from "@/lib/types.js";

export const CART_SESSION_COOKIE = "cart_session";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Guest carts are keyed by an opaque UUID stored in an httpOnly cookie.
 * Prefer cookie over headers so SvelteKit storefronts work without custom client wiring.
 * On login, merge the guest cart into the customer cart then clear this cookie.
 */
export function getCartSessionId(c: Context<AppBindings>) {
	return getCookie(c, CART_SESSION_COOKIE) ?? null;
}

export function ensureCartSessionId(c: Context<AppBindings>) {
	const existing = getCartSessionId(c);
	if (existing) {
		return existing;
	}

	const sessionId = crypto.randomUUID();
	setCookie(c, CART_SESSION_COOKIE, sessionId, {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: COOKIE_MAX_AGE_SECONDS,
		...(c.env.COOKIE_DOMAIN ? { domain: c.env.COOKIE_DOMAIN } : {}),
	});
	return sessionId;
}

export function clearCartSessionId(c: Context<AppBindings>) {
	setCookie(c, CART_SESSION_COOKIE, "", {
		httpOnly: true,
		secure: true,
		sameSite: "Lax",
		path: "/",
		maxAge: 0,
		...(c.env.COOKIE_DOMAIN ? { domain: c.env.COOKIE_DOMAIN } : {}),
	});
}
