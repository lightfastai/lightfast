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
    const {
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
      correlationId,
    } = event.data;

    if (significanceScore < NOTIFICATION_SIGNIFICANCE_THRESHOLD) {
      log.info("[notification-dispatch] below threshold, skipping", {
        clerkOrgId,
        eventExternalId,
        significanceScore,
        correlationId,
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
        log.info("[notification-dispatch] Knock not configured, skipping", {
          clerkOrgId,
          eventExternalId,
          correlationId,
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

      log.info("[notification-dispatch] Knock notification triggered", {
        clerkOrgId,
        eventExternalId,
        significanceScore,
        correlationId,
      });
    });

    return { status: "sent", eventExternalId };
  }
);
