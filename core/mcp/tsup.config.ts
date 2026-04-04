import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  bundle: true,
  external: ["@modelcontextprotocol/sdk"],
  outExtension: () => ({ js: ".mjs" }),
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
