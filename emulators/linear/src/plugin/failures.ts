import { createFailures } from "@repo/emulator-kit";

const LINEAR_FAILURE_NAMES = [
  "accessTokenExpired",
  "mcpListTools",
  "refresh",
] as const;

export const { getFailures, registerFailures, seedFailures } =
  createFailures(LINEAR_FAILURE_NAMES);
