import { log } from "@vendor/observability/log/next";
import { inngest } from "../client";

const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const memoryNotificationDispatch = inngest.createFunction(
  {
    id: "memory/notification.dispatch",
    name: "Notification Dispatch",
    description: "Dispatches high-significance event notifications via Knock",
    retries: 2,
    timeouts: { finish: "1m" },
  },
  { event: "memory/event.stored" },
  async ({ event, step }) => {
    const {
      workspaceId,
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
    } = event.data;

    if (!clerkOrgId) {
      return { status: "skipped", reason: "no_clerk_org_id" };
    }

    if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
      };
    }

    await step.run("trigger-knock-workflow", async () => {
      const { notifications } = await import("@vendor/knock");

      if (!notifications) {
        log.info("Knock not configured, skipping notification", {
          workspaceId,
          eventExternalId,
        });
        return;
      }

      await notifications.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
        recipients: [{ id: clerkOrgId }],
        tenant: clerkOrgId,
        data: {
          eventExternalId,
          eventType: sourceType,
          significanceScore,
          workspaceId,
        },
      });

      log.info("Knock notification triggered", {
        workspaceId,
        eventExternalId,
        significanceScore,
      });
    });

    return { status: "sent", eventExternalId };
  }
);
