import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "src/index": "src/index.ts",
    "src/env": "src/env.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/^@repo\//, /^@vendor\//, /^@db\//],
});
