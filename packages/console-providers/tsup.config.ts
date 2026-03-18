import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    contracts: "src/contracts.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
