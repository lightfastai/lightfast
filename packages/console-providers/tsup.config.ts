import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    display: "src/display.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
