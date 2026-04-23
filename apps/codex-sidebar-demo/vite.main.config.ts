import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main/bootstrap.ts",
      formats: ["cjs"],
      fileName: () => "bootstrap.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
