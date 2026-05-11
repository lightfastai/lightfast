import type { AnyContractProcedure } from "@orpc/contract";
import { implement } from "@orpc/server";

import type { InitialContext } from "./context";
import { authMiddleware } from "./middleware/auth";
import { observabilityMiddleware } from "./middleware/observability";

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
