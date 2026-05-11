import { apiContract } from "@repo/api-contract";

import { authed } from "../procedures";

const SDK_VERSION = "0.1.0";

export const systemRouter = {
  health: authed(apiContract.system.health).handler(({ context: _ctx }) => ({
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    version: SDK_VERSION,
  })),
};
