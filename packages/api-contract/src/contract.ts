import { oc } from "@orpc/contract";

import {
  createSignalInput,
  createSignalOutput,
  getSignalInput,
  getSignalOutput,
} from "./schemas/signals";
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

const signals = {
  create: oc
    .route({
      method: "POST",
      path: "/signals",
      successStatus: 202,
      summary: "Create signal",
      description:
        "Creates an org-scoped signal from raw text and queues asynchronous classification.",
    })
    .input(createSignalInput)
    .output(createSignalOutput),

  get: oc
    .route({
      method: "GET",
      path: "/signals/{id}",
      summary: "Get signal",
      description:
        "Returns a single org-scoped signal and its current classification state.",
    })
    .input(getSignalInput)
    .output(getSignalOutput),
};

export const apiContract = { signals, system };

export type Contract = typeof apiContract;
