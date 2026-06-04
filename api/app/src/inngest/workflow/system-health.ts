import { env } from "../../env";
import { inngest } from "../client";

export const systemHealth = inngest.createFunction(
  {
    id: "system-health",
    retries: 0,
    triggers: { cron: "*/30 * * * *" },
    timeouts: {
      finish: "30s",
      start: "30s",
    },
  },
  async ({ step }) =>
    step.run("collect app health", () => ({
      app: "lightfast-app",
      environment: env.VERCEL_ENV,
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    }))
);
