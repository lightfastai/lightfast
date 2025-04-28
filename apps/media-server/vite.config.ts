import reactStack from "hono-vite-react-stack";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    reactStack({
      serverEntry: "./src/server.tsx",
      clientEntry: "./src/client/index.tsx",
    }),
  ],
});
