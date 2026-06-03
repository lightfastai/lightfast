import { env } from "../../env";
import { inngest } from "../client";

export const systemHealth = inngest.createFunction(
  {
    id: "system-health",
    idempotency: "event.id",
    retries: 2,
    triggers: { cron: "*/30 * * * *" },
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
