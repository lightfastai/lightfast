import { listActiveOrgNamespaceClerkOrgIds } from "@db/app";
import { db } from "@db/app/client";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";

import { syncTeamMembersForOrg } from "../../services/team-members/people-sync";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

const MAX_ORG_PAGES_PER_RUN = 10;
const ORG_PAGE_LIMIT = 100;

function getReconcileCursor(data: unknown): number | null {
  if (!data || typeof data !== "object" || !("cursor" in data)) {
    return null;
  }
  const cursor = (data as { cursor?: unknown }).cursor;
  return typeof cursor === "number" && Number.isInteger(cursor) && cursor > 0
    ? cursor
    : null;
}

function getReconcileSyncedAtIso(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || !("syncedAtIso" in data)) {
    return;
  }
  const syncedAtIso = (data as { syncedAtIso?: unknown }).syncedAtIso;
  return typeof syncedAtIso === "string" ? syncedAtIso : undefined;
}

export const teamMemberReconciler = inngest.createFunction(
  {
    id: "team-member-reconciler",
    idempotency: "event.id",
    retries: 1,
    timeouts: {
      finish: "10m",
      start: "2m",
    },
    triggers: [
      { cron: "*/15 * * * *" },
      appEvents["app/team-members.reconcile.requested"],
    ],
  },
  async ({ event, step }) => {
    const eventData = event.data;
    const syncedAtIso =
      getReconcileSyncedAtIso(eventData) ??
      (await step.run("collect team member sync timestamp", () =>
        new Date().toISOString()
      ));
    const totals = {
      membersMarkedFormer: 0,
      membersSeen: 0,
      membersSkippedNoEmail: 0,
      membersUpserted: 0,
      orgsChecked: 0,
      orgsFailed: 0,
    };
    let cursor: number | null = getReconcileCursor(eventData);
    let orgPagesChecked = 0;

    while (orgPagesChecked < MAX_ORG_PAGES_PER_RUN) {
      const page: {
        items: { clerkOrgId: string; id: number }[];
        nextCursor: number | null;
      } = await step.run(
        `list active org namespaces ${cursor ?? "first"}`,
        () =>
          listActiveOrgNamespaceClerkOrgIds(db, {
            cursor,
            limit: ORG_PAGE_LIMIT,
          })
      );

      for (const org of page.items) {
        try {
          const result = await step.run(
            `sync team members ${org.clerkOrgId}`,
            async () => {
              const clerk = await clerkClient();
              return syncTeamMembersForOrg({
                clerk,
                clerkOrgId: org.clerkOrgId,
                db,
                syncedAt: new Date(syncedAtIso),
              });
            }
          );

          totals.orgsChecked += 1;
          totals.membersMarkedFormer += result.membersMarkedFormer;
          totals.membersSeen += result.membersSeen;
          totals.membersSkippedNoEmail += result.membersSkippedNoEmail;
          totals.membersUpserted += result.membersUpserted;
        } catch (error) {
          totals.orgsFailed += 1;
          log.warn("[people] team member sync failed", {
            clerkOrgId: org.clerkOrgId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
        }
      }

      orgPagesChecked += 1;
      cursor = page.nextCursor;
      if (!cursor) {
        break;
      }
    }

    if (cursor) {
      await step.sendEvent("continue team member reconciliation", {
        name: "app/team-members.reconcile.requested",
        data: {
          cursor,
          syncedAtIso,
        },
      });
    }

    return {
      ...totals,
      orgPagesChecked,
    };
  }
);
