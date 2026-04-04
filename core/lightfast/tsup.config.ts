import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [],
  target: "node18",
  bundle: true,
  silent: false,
  outExtension() {
    return { js: ".mjs" };
  },
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
