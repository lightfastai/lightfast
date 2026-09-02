import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  entry: ["src/main.ts"],
  external: ["electron"],
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  sourcemap: true,
  target: "node22",
});
