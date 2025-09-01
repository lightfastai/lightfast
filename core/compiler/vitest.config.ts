import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"dist/**",
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/*.config.ts",
				"src/test-utils/**",
			],
			thresholds: {
				branches: 70,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
		include: ["src/**/*.{test,spec}.ts"],
		exclude: ["node_modules", "dist"],
		testTimeout: 10000,
		hookTimeout: 10000,
	},
	resolve: {
		alias: {
			"~": resolve(__dirname, "./src"),
		},
	},
});