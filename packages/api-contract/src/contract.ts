import { oc } from "@orpc/contract";

import { systemHealthOutput } from "./schemas/system";

const system = {
  health: oc
    .route({
      method: "GET",
      path: "/system/health",
      summary: "Health check",
      description:
        "Returns service status, server timestamp, and API version. Requires a valid org API key.",
    })
    .output(systemHealthOutput),
};

export const apiContract = { system };

export type Contract = typeof apiContract;
