import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export function createDb(env: Pick<Env, "DATABASE_URL">) {
	const client = neon(env.DATABASE_URL);
	return drizzle({ client, schema });
}

export type DB = ReturnType<typeof createDb>;
