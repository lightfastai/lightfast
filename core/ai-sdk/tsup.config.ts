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
  },

  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,

  // External dependencies - don't bundle
  external: ["@upstash/redis", "ai", "resumable-stream", "uuid", "zod"],

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
