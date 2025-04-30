import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === "serve";
  const isBuild = command === "build";
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    plugins: [
      react(),
      electron([
        {
          // Main process entry
          entry: "src/main/index.ts",
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log("[startup] Electron App");
            } else {
              startup();
            }
          },
          vite: {
            build: {
              sourcemap: sourcemap ? "inline" : undefined,
              minify: isBuild,
              outDir: "dist-electron/main",
              rollupOptions: {
                external: ["electron"],
              },
            },
            plugins: [
              // Enables hot reload for main process
              isServe && electron([{ entry: ["src/main/index.ts"] }]),
            ],
          },
        },
        {
          // Preload scripts entry
          entry: "src/preload/index.ts",
          onstart(args) {
            // Notify the Renderer process to reload the page when the Preload scripts build is complete,
            // instead of restarting the entire Electron App.
            args.reload();
          },
          vite: {
            build: {
              sourcemap: sourcemap ? "inline" : undefined,
              minify: isBuild,
              outDir: "dist-electron/preload",
              rollupOptions: {
                external: ["electron"],
              },
            },
          },
        },
      ]),
      // Enable HMR in renderer process
      renderer({
        nodeIntegration: true,
      }),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    clearScreen: false,
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      hmr: {
        overlay: true,
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap,
      minify: isBuild,
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
      },
    },
  };
}); 