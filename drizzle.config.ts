import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig } from "drizzle-kit";

expand(config({ override: true }));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is required for drizzle-kit");
}

export default defineConfig({
	out: "./src/db/migrations",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	strict: true,
	verbose: true,
	dbCredentials: {
		url: databaseUrl,
	},
});
