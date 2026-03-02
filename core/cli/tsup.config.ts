import { defineConfig } from "tsup";
import pkg from "./package.json";

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts"],
  format: "esm",
  dts: true,
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
