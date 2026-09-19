import { drizzle } from "drizzle-orm/node-postgres";
import type { Environment } from "../env.js";
import * as schema from "./schema.js";

type DBEnv = Pick<Environment, "DATABASE_URL">

export function createDb(env: DBEnv){
	return drizzle({
		schema,
		connection: env.DATABASE_URL
	});
}
