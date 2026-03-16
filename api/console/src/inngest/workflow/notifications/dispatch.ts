import { notifications } from "@vendor/knock";
import { log } from "@vendor/observability/log";
import { inngest } from "../../client/client";

const NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70;
const OBSERVATION_WORKFLOW_KEY = "observation-captured";

export const notificationDispatch = inngest.createFunction(
  {
    id: "apps-console/notification.dispatch",
    name: "Notification Dispatch",
    description: "Dispatches high-significance event notifications via Knock",
    retries: 2,
    timeouts: { finish: "1m" },
  },
  { event: "apps-console/event.stored" },
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

    const notificationsClient = notifications;
    if (!notificationsClient) {
      return { status: "skipped", reason: "knock_not_configured" };
    }

    await step.run("trigger-knock-workflow", async () => {
      await notificationsClient.workflows.trigger(OBSERVATION_WORKFLOW_KEY, {
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
