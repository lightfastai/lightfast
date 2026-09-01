import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.HOST;
const port = process.env.PORT ? Number(process.env.PORT) : undefined;
const portlessUrl = process.env.PORTLESS_URL;
const hmrHost = portlessUrl ? new URL(portlessUrl).hostname : undefined;

export default defineConfig({
  plugins: [...tanstackStart(), react()],
  server: {
    ...(host ? { host } : {}),
    ...(port ? { port, strictPort: true } : {}),
    ...(hmrHost
      ? {
          hmr: {
            clientPort: 443,
            host: hmrHost,
            protocol: "wss" as const,
          },
        }
      : {}),
  },
});
