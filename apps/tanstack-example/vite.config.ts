import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { buildEnv, devServer } from "./env.build";

const { host, port } = devServer;

process.env.VITE_LIGHTFAST_APP_URL = buildEnv.VITE_LIGHTFAST_APP_URL;
process.env.VITE_TANSTACK_EXAMPLE_URL = buildEnv.VITE_TANSTACK_EXAMPLE_URL;

export default defineConfig({
  plugins: [...tanstackStart(), react()],
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
