import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		// Main entry point
		index: "./src/core/index.ts",
		
		// Client API
		"client/index": "./src/core/client/index.ts",
		
		// Core primitives
		agent: "./src/core/primitives/agent.ts",
		tool: "./src/core/primitives/tool.ts",

		// Server adapters
		"server/adapters/fetch": "./src/core/server/adapters/fetch.ts",
		"server/adapters/types": "./src/core/server/adapters/types.ts",

		// Memory (single export per unique file)
		memory: "./src/core/memory/index.ts",
		"memory/adapters/in-memory": "./src/core/memory/adapters/in-memory.ts",
		"memory/adapters/redis": "./src/core/memory/adapters/redis.ts",

		// Cache
		cache: "./src/core/primitives/cache/index.ts",

		// Providers
		providers: "./src/utils/providers.ts",

		// V2 exports
		"v2/agent": "./src/core/v2/agent.ts",
		"v2/server": "./src/v2/server.ts",
		"v2/react": "./src/v2/react.ts",
		"v2/core": "./src/core/v2/core.ts",
		"v2/index": "./src/core/v2/index.ts",
		"v2/utils": "./src/core/v2/utils/index.ts",
		"v2/events": "./src/core/v2/server/events/types.ts",
		"v2/env": "./src/core/v2/env.ts",
		"v2/braintrust-env": "./src/core/v2/braintrust-env.ts",
	},

	format: ["esm"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,

	// External dependencies - don't bundle
	external: [
		"@ai-sdk/anthropic",
		"@ai-sdk/gateway",
		"@ai-sdk/provider",
		"@t3-oss/env-core",
		"@upstash/qstash",
		"@upstash/redis",
		"ai",
		"braintrust",
		"pino",
		"resumable-stream",
		"uuid",
		"zod",
		"react",
		"react-dom",
	],

	// Target Node.js 18+
	target: "node18",

	// Bundle for npm publishing
	bundle: true,

	// Keep tsup quiet during build
	silent: false,

	// Output file naming
	outExtension() {
		return {
			js: ".mjs",
		};
	},
});
