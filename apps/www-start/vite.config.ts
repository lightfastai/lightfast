import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { buildEnv, devServer } from "./env.build";

const { host, port } = devServer;

process.env.VITE_LIGHTFAST_APP_URL = buildEnv.VITE_LIGHTFAST_APP_URL;
process.env.VITE_LIGHTFAST_PLATFORM_URL =
  buildEnv.VITE_LIGHTFAST_PLATFORM_URL;
process.env.VITE_LIGHTFAST_WWW_URL = buildEnv.VITE_LIGHTFAST_WWW_URL;
process.env.VITE_WWW_START_URL = buildEnv.VITE_WWW_START_URL;

export default defineConfig({
  plugins: [...tanstackStart(), react(), tailwindcss()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    ...(host ? { host } : {}),
    ...(port ? { port, strictPort: true } : {}),
  },
});
