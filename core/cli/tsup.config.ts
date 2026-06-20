import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node22",
  bundle: true,
  noExternal: [
    "@lightfast/connector-core",
    "@repo/api-contract",
    "@repo/native-auth-contract",
    "@repo/native-auth-node",
    "@t3-oss/env-core",
    "commander",
    "zod",
  ],
  outExtension: () => ({ js: ".mjs" }),
  sourcemap: false,
  dts: false,
  clean: true,
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __lightfastCreateRequire } from "node:module";',
      "const require = __lightfastCreateRequire(import.meta.url);",
    ].join("\n"),
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
