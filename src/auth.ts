/**
 * Better Auth CLI entry (Node only). Not imported by the Worker.
 */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { createDb } from "./db/db.js";
import { createAuth } from "./lib/auth.js";
import { envSchema } from "./lib/env.js";

expand(config({ override: true }));

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	throw new Error(`Invalid environment for auth CLI: ${parsed.error.message}`);
}

const env = parsed.data as Env;
export const auth = createAuth(env, createDb(env));
