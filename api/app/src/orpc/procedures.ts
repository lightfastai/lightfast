import { implement, type ContractProcedure } from "@orpc/server";

import type { InitialContext } from "./context";
import { authMiddleware } from "./middleware/auth";
import { observabilityMiddleware } from "./middleware/observability";

/**
 * Wrap a contract procedure with the public oRPC middleware stack
 * (observability + API-key auth). Returns a typed implementer whose
 * `.handler(...)` is checked against the contract's output schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ContractProcedure<any,any,any,any> matches AnyContractProcedure; the implementer narrows ctx/output downstream.
export const authed = <P extends ContractProcedure<any, any, any, any>>(
  proc: P
) =>
  implement(proc)
    .$context<InitialContext>()
    .use(observabilityMiddleware)
    .use(authMiddleware);
