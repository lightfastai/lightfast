import type { Context, Store } from "@emulators/core";
import { bearerToken } from "@repo/emulator-kit";

import { LINEAR_EMULATOR_FIXTURES } from "../fixtures";
import { getFailures } from "./failures";

export function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}
