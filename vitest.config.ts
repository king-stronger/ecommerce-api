import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(root, "src"),
		},
	},
	test: {
		environment: "node",
		setupFiles: ["./src/test/setup.ts"],
		fileParallelism: false,
		isolate: false,
		hookTimeout: 60_000,
		testTimeout: 60_000,
		include: ["src/**/*.test.ts"],
	},
});
