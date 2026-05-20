import type { AnyContractProcedure } from "@orpc/contract";
import { implement } from "@orpc/server";

import type { InitialContext } from "./context";
import { authMiddleware } from "./middleware/auth";
import { observabilityMiddleware } from "./middleware/observability";
import { orgGateMiddleware } from "./middleware/org-gate";

/**
 * Wrap a contract procedure with the public oRPC middleware stack
 * (observability + API-key auth). Returns a typed implementer whose
 * `.handler(...)` is checked against the contract's output schema.
 */
export const authed = <P extends AnyContractProcedure>(proc: P) =>
  implement(proc)
    .$context<InitialContext>()
    .use(observabilityMiddleware)
    .use(authMiddleware);

/**
 * Like `authed`, but additionally requires the API key's org to be *bound* —
 * i.e. to have completed source-control setup. Clerk API keys carry no session
 * claims, so `authMiddleware` derives the org gate server-side from the
 * authoritative DB binding and `orgGateMiddleware` enforces it.
 *
 * Use this for product API features that need a usable Lightfast org. Pure
 * connectivity/diagnostic endpoints (e.g. `system.health`) stay on `authed`.
 */
export const boundOrg = <P extends AnyContractProcedure>(proc: P) =>
  implement(proc)
    .$context<InitialContext>()
    .use(observabilityMiddleware)
    .use(authMiddleware)
    .use(orgGateMiddleware);
