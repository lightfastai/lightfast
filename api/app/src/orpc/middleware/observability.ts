import { os } from "@orpc/server";
import { createORPCObservabilityMiddleware } from "@vendor/observability/orpc";

import type { InitialContext } from "../context";

const base = os.$context<InitialContext>();

export const observabilityMiddleware = base.middleware(
  createORPCObservabilityMiddleware()
);
