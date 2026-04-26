import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ""),
  },
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
