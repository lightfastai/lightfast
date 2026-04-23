import type { ReplayTarget } from "./types";

const DEFAULT_APP_BASE_URL = "http://localhost:3024";
const DEFAULT_PLATFORM_BASE_URL = "http://localhost:4112";

export const DEFAULT_ASSERTION_TIMEOUT_MS = 20_000;
export const DEFAULT_POLL_INTERVAL_MS = 500;

export function resolveBaseUrl(
  target: ReplayTarget,
  override?: string
): string {
  if (override) {
    return override;
  }
  return target === "app" ? DEFAULT_APP_BASE_URL : DEFAULT_PLATFORM_BASE_URL;
}
