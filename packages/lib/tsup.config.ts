import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "pretty-project-name": "src/pretty-project-name.ts",
    "datetime/index": "src/datetime/index.ts",
    uuid: "src/uuid.ts",
    nanoid: "src/nanoid.ts",
    "friendly-words": "src/friendly-words.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
