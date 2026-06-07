import type { EmulatorManifest } from "@repo/emulator-kit";

import { startGranolaEmulator } from "./server";

export const granolaManifest: EmulatorManifest = {
  name: "granola",
  port: 4570,
  env: ({ publicOrigin }) => ({
    GRANOLA_MCP_ENDPOINT: `${publicOrigin}/mcp`,
  }),
  start: startGranolaEmulator,
};
