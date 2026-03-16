import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    workspace: "src/workspace.ts",
    organization: "src/organization.ts",
  },
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
});
