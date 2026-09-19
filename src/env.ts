import { config } from "dotenv";
import { expand } from "dotenv-expand";
import z from "zod";

expand(config());

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3000),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
	DATABASE_URL: z.url(),
	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	throw new Error(`Invalid error ${parsed.error.flatten}`);
}

const env = parsed.data;

export type Environment = typeof env;
export default env;
