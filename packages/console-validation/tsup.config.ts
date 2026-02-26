import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "primitives/index": "src/primitives/index.ts",
    "schemas/index": "src/schemas/index.ts",
    "forms/index": "src/forms/index.ts",
    "constants/index": "src/constants/index.ts",
    "utils/index": "src/utils/index.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
