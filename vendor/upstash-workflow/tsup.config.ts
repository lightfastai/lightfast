import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "src/index": "src/index.ts",
    env: "env.ts",
    "src/client": "src/client.ts",
    "src/hono": "src/hono.ts",
    "src/nextjs": "src/nextjs.ts",
    "src/types": "src/types.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
