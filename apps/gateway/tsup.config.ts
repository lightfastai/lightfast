import { defineConfig } from "tsup";

const serverOnlyShim = {
  name: "server-only-shim",
  setup(build: { onResolve: Function; onLoad: Function }) {
    build.onResolve({ filter: /^server-only$/ }, () => ({
      path: "server-only",
      namespace: "server-only-shim",
    }));
    build.onLoad({ filter: /.*/, namespace: "server-only-shim" }, () => ({
      contents: "",
      loader: "js",
    }));
  },
};

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
  esbuildPlugins: [serverOnlyShim],
});
