import { createFailures } from "@repo/emulator-kit";

const X_FAILURE_NAMES = ["accessTokenExpired", "refresh", "usersMe"] as const;

export const { getFailures, registerFailures, seedFailures } =
  createFailures(X_FAILURE_NAMES);
