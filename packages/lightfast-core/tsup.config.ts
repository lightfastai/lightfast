import { defineConfig } from "tsup";

export default defineConfig({
  // Only include v1 entry points - exclude v2
  entry: {
    // Core primitives
    "agent": "./src/core/primitives/agent.ts",
    "tool": "./src/core/primitives/tool.ts",
    
    // Server adapters
    "agent/handlers": "./src/core/server/adapters/fetch.ts",
    "agent/server/adapters/fetch": "./src/core/server/adapters/fetch.ts",
    "agent/server/adapters/types": "./src/core/server/adapters/types.ts",
    
    // Memory
    "agent/memory": "./src/core/memory/index.ts", 
    "memory": "./src/core/memory/index.ts",
    "memory/adapters/in-memory": "./src/core/memory/adapters/in-memory.ts",
    "agent/memory/adapters/redis": "./src/core/memory/adapters/redis.ts",
    "agent/memory/redis": "./src/core/memory/adapters/redis.ts", 
    "agent/redis-memory": "./src/core/memory/adapters/redis.ts",
    
    // Cache
    "agent/primitives/cache": "./src/core/primitives/cache/index.ts",
    
    // Providers
    "providers": "./src/utils/providers.ts"
  },
  
  // Output settings
  format: ["cjs", "esm"],
  outDir: "dist",
  clean: true,
  
  // Skip types for now - will use tsc separately
  dts: false,
  
  // Bundle for npm publishing
  bundle: true,
  splitting: false,
  sourcemap: true,
  
  // Target modern Node.js
  target: "node18",
  
  // External dependencies (don't bundle)
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
    "zod"
  ],
  
  // Keep tsup quiet during build
  silent: false
});