import { log } from "@vendor/observability/log/next";
import { inngest } from "../client";

const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const platformNotificationDispatch = inngest.createFunction(
  {
    id: "platform/notification.dispatch",
    name: "Notification Dispatch",
    description: "Dispatches high-significance event notifications via Knock",
    retries: 2,
    timeouts: { finish: "1m" },
  },
  { event: "platform/event.stored" },
  async ({ event, step }) => {
    const { clerkOrgId, eventExternalId, sourceType, significanceScore } =
      event.data;

    if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      log.info("below threshold, skipping", {
        eventExternalId,
        significanceScore,
      });
      return {
        status: "skipped",
        reason: "below_notification_threshold",
        significanceScore,
      };
    }

    await step.run("trigger-knock-workflow", async () => {
      const { notifications } = await import("@vendor/knock");

      if (!notifications) {
        log.info("Knock not configured, skipping", {
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
        },
      });
    });

    return { status: "sent", eventExternalId };
  }
);
