import type { EmulatorManifest } from "@repo/emulator-kit";

import { LINEAR_EMULATOR_FIXTURES } from "./fixtures";
import { startLinearEmulator } from "./server";

export const linearManifest: EmulatorManifest = {
  name: "linear",
  port: 4568,
  env: ({ publicOrigin }) => ({
    LINEAR_CLIENT_ID: LINEAR_EMULATOR_FIXTURES.oauthClientId,
    LINEAR_CLIENT_SECRET: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
    LINEAR_API_ORIGIN: publicOrigin,
    LINEAR_MCP_ENDPOINT: `${publicOrigin}/mcp`,
  }),
  start: startLinearEmulator,
};
