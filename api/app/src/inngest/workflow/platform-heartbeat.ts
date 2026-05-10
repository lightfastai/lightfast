import { createPlatformClient } from "@repo/platform-client";

import { platformUrl } from "../../origins";
import { inngest } from "../client";

// Exported for unit testing — the InngestFunction's handler is otherwise
// only reachable through the Inngest runtime.
export async function callPlatformHealthAsInngest(baseUrl: string) {
  const platform = createPlatformClient({
    caller: "inngest",
    baseUrl,
  });
  return platform.system.health.query();
}

export const platformHeartbeat = inngest.createFunction(
  {
    id: "app/platform-heartbeat",
    name: "Platform Heartbeat",
    retries: 1,
  },
  { cron: "0 * * * *" },
  async ({ step }) =>
    step.run("call-platform-health", () =>
      callPlatformHealthAsInngest(platformUrl)
    )
);
