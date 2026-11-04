import { z } from "zod";

export const envSchema = z.object({
	DATABASE_URL: z.url(),
	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string().min(32),
	TRUSTED_ORIGINS: z.string().min(1),
	COOKIE_DOMAIN: z.string().optional().default(""),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
});

const validated = new WeakSet<object>();

export function assertEnv(env: Env): void {
	if (validated.has(env as object)) {
		return;
	}

	const parsed = envSchema.safeParse(env);
	if (!parsed.success) {
		throw new Error(`Invalid environment: ${parsed.error.message}`);
	}

	validated.add(env as object);
}
