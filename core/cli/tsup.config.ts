import { defineConfig } from "tsup";
import pkg from "./package.json";

const shared = {
  format: ["esm"] as const,
  sourcemap: true,
  target: "node18" as const,
  outExtension: () => ({ js: ".mjs" }),
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/bin.ts"],
    dts: false,
    clean: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    ...shared,
    entry: ["src/index.ts"],
    dts: true,
    clean: false,
  },
]);
