import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname, "src/renderer"),
  build: {
    outDir: resolve(import.meta.dirname, ".vite/renderer/main_window"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "src/renderer/index.html"),
    },
  },
});
