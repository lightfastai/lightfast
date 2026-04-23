import type { LocalE2EScenario } from "../types";

export const githubPrClosedScenario: LocalE2EScenario = {
  name: "github-pr-closed",
  description:
    "Replay a GitHub pull_request.closed webhook through the real local ingest path.",
  clerkOrgId: "org_lightfast_local",
  clerkUserId: "user_lightfast_local",
  connections: [
    {
      provider: "github",
      installationExternalId: "42424242",
      providerResourceId: "900000589",
    },
  ],
  replays: [
    {
      fixture: "github/pull_request.closed.json",
      expectedDeliveryStatus: "processed",
      expectedIngestLogs: 1,
      resourceIdOverride: "900000589",
    },
  ],
};
