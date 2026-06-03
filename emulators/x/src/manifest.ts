import type { EmulatorManifest } from "@repo/emulator-kit";

import { X_EMULATOR_FIXTURES } from "./fixtures";
import { startXEmulator } from "./server";

export const xManifest: EmulatorManifest = {
  name: "x",
  port: 4569,
  env: ({ callbackUrl, publicOrigin }) => ({
    X_CLIENT_ID: X_EMULATOR_FIXTURES.oauthClientId,
    X_CLIENT_SECRET: X_EMULATOR_FIXTURES.oauthClientSecret,
    X_API_ORIGIN: publicOrigin,
    ...(callbackUrl ? { X_MCP_ENDPOINT: callbackUrl } : {}),
    X_OAUTH_ORIGIN: publicOrigin,
  }),
  start: startXEmulator,
};
