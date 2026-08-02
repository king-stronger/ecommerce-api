import { drizzle } from "drizzle-orm/node-postgres";
import env from "../env.js";
import * as schema from "./schema.js";

export const db = drizzle({
	schema,
	connection: {
		port: env.DB_PORT,
		host: env.DB_HOST,
		database: env.DB_NAME,
		user: env.DB_USER,
		password: env.DB_PASSWORD,
		ssl: false,
	},
});
