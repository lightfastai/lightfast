import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname, "src/renderer"),
  // Load .env.* from the desktop app root (next to package.json), not from
  // src/renderer — otherwise VITE_* vars are silently undefined and
  // entry.tsx falls back to the prod base URL.
  envDir: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    // Follow pnpm symlinks to real paths so esbuild's optimizer resolves
    // transitive CJS peers (e.g. copy-anything imported by superjson) via the
    // .pnpm store layout instead of getting stuck in symlinked node_modules
    // that lack the peer.
    preserveSymlinks: false,
  },
  optimizeDeps: {
    include: [
      "@repo/app-trpc/desktop",
      "@repo/app-trpc/react",
      "superjson",
      "sonner",
    ],
  },
  build: {
    outDir: resolve(import.meta.dirname, ".vite/renderer/main_window"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(import.meta.dirname, "src/renderer/index.html"),
    },
  },
});
