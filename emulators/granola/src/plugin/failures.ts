import { createFailures } from "@repo/emulator-kit";

const GRANOLA_FAILURE_NAMES = [
  "accessTokenExpired",
  "mcpListTools",
  "refresh",
] as const;

export const { getFailures, registerFailures, seedFailures } = createFailures(
  GRANOLA_FAILURE_NAMES
);
