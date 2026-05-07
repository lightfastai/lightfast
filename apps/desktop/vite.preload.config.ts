import { defineConfig } from "vite";

// Shared by all preload entries declared in forge.config.ts.
// electron-forge plugin-vite supplies build.rollupOptions.input from each
// build[].entry and emits via output.entryFileNames: '[name].js', so each
// forge entry produces a bundle named after its file basename.
export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      external: ["electron"],
    },
  },
});
