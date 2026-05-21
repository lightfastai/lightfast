import { oc } from "@orpc/contract";

import {
  createOpportunityInput,
  createOpportunityOutput,
  getOpportunityInput,
  getOpportunityOutput,
} from "./schemas/opportunities";
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

const opportunities = {
  create: oc
    .route({
      method: "POST",
      path: "/opportunities",
      successStatus: 202,
      summary: "Create opportunity",
      description:
        "Creates an org-scoped opportunity from raw text and queues asynchronous classification.",
    })
    .input(createOpportunityInput)
    .output(createOpportunityOutput),

  get: oc
    .route({
      method: "GET",
      path: "/opportunities/{id}",
      summary: "Get opportunity",
      description:
        "Returns a single org-scoped opportunity and its current classification state.",
    })
    .input(getOpportunityInput)
    .output(getOpportunityOutput),
};

export const apiContract = { opportunities, system };

export type Contract = typeof apiContract;
