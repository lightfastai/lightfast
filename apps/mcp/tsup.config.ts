import { defineConfig } from "tsup";

export default defineConfig({
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  clean: true,
  entry: ["src/index.ts"],
  external: ["@modelcontextprotocol/sdk"],
  format: ["esm"],
  noExternal: ["@vendor/mcp"],
  outExtension: () => ({ js: ".mjs" }),
  sourcemap: true,
  target: "node22",
});
