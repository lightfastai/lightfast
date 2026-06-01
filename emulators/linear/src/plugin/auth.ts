import type { Context, Store } from "@emulators/core";

import { LINEAR_EMULATOR_FIXTURES } from "../fixtures";
import { getFailures } from "./failures";

export function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

export function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}
