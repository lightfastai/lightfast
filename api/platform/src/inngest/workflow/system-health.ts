import { env } from "../../env";
import { inngest } from "../client";

export const systemHealth = inngest.createFunction(
  {
    id: "system-health",
    retries: 0,
    triggers: { cron: "* * * * *" },
    timeouts: {
      finish: "30s",
      start: "30s",
    },
  },
  async ({ step }) =>
    step.run("collect platform health", () => ({
      app: "lightfast-platform",
      environment: env.VERCEL_ENV,
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    }))
);
