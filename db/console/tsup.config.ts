import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "src/index": "src/index.ts",
    "src/schema/index": "src/schema/index.ts",
    "src/client": "src/client.ts",
    "src/utils/workspace": "src/utils/workspace.ts",
    env: "env.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/^@repo\//, /^@vendor\//, /^@db\//],
});
