import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node22",
  bundle: true,
  noExternal: [
    "@repo/native-auth-contract",
    "@repo/native-auth-node",
    "@t3-oss/env-core",
    "zod",
  ],
  outExtension: () => ({ js: ".mjs" }),
  sourcemap: true,
  dts: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
