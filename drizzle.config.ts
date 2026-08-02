import { defineConfig } from "drizzle-kit";
import env from "./src/env.js";

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	strict: true,
	verbose: true,
	dbCredentials: {
		port: env.DB_PORT,
		host: env.DB_HOST,
		database: env.DB_NAME,
		user: env.DB_USER,
		password: env.DB_PASSWORD,
		ssl: false,
	},
});
