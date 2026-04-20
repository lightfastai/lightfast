import type { LocalE2EScenario } from "../types";

export const vercelDeploymentSucceededScenario: LocalE2EScenario = {
  name: "vercel-deployment-succeeded",
  description:
    "Replay a Vercel deployment.succeeded webhook through the real local ingest path.",
  clerkOrgId: "org_lightfast_local",
  clerkUserId: "user_lightfast_local",
  connections: [
    {
      provider: "vercel",
      installationExternalId: "ve_installation_local",
      providerResourceId: "prj_local_e2e_vercel",
    },
  ],
  replays: [
    {
      fixture: "vercel/deployment.succeeded.json",
      expectedDeliveryStatus: "processed",
      expectedIngestLogs: 1,
      resourceIdOverride: "prj_local_e2e_vercel",
    },
  ],
};
