import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import "./src/env";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  plugins: [tanstackStart(), react()],
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
