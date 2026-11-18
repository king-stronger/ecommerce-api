import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { DB } from "../db/db.js";
import * as schema from "../db/schema.js";

type AuthEnv = Pick<
	Env,
	"BETTER_AUTH_URL" | "BETTER_AUTH_SECRET" | "TRUSTED_ORIGINS" | "COOKIE_DOMAIN"
>;

function isHttps(url: string) {
	try {
		return new URL(url).protocol === "https:";
	} catch {
		return false;
	}
}

export function createAuth(env: AuthEnv, db: DB) {
	const trustedOrigins = env.TRUSTED_ORIGINS.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema,
		}),
		emailAndPassword: {
			enabled: true,
		},
		advanced: {
			// Storefront and API live on different sites in production (workers.dev),
			// so cookies must be SameSite=None; Secure to be sent with credentialed fetches.
			...(isHttps(env.BETTER_AUTH_URL)
				? {
						defaultCookieAttributes: {
							sameSite: "none" as const,
							secure: true,
						},
					}
				: {}),
			...(env.COOKIE_DOMAIN
				? {
						crossSubDomainCookies: {
							enabled: true,
							domain: env.COOKIE_DOMAIN,
						},
					}
				: {}),
		},
		plugins: [admin()],
	});
}

export type Auth = ReturnType<typeof createAuth>;
