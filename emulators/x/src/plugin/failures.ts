import { createFailures } from "@repo/emulator-kit";

const X_FAILURE_NAMES = [
  "accessTokenExpired",
  "postsLookup",
  "refresh",
  "socialWrite",
  "usersLookup",
  "usersMe",
] as const;

export const { getFailures, registerFailures, seedFailures } =
  createFailures(X_FAILURE_NAMES);
