import type { Database } from "@db/app";
import type { OrgSetupGate } from "@repo/app-setup-contract";
import { auth } from "~/compat/clerk-server";
import { resolveWorkspaceAssistantOrgSetupGate } from "~/server/chat/org-setup-gate";

export type WorkspaceAssistantAuthIdentity =
  | { type: "unauthenticated" }
  | { type: "pending"; userId: string }
  | { type: "active"; userId: string; orgId: string; orgGate: OrgSetupGate };

export interface WorkspaceAssistantAuthContext {
  identity: WorkspaceAssistantAuthIdentity;
}

export async function resolveWorkspaceAssistantAuthContext(input: {
  db: Database;
}): Promise<WorkspaceAssistantAuthContext> {
  const session = await auth({ treatPendingAsSignedOut: false });
  if (!session.userId) {
    return { identity: { type: "unauthenticated" } };
  }
  if (!session.orgId) {
    return { identity: { type: "pending", userId: session.userId } };
  }

  return {
    identity: {
      type: "active",
      userId: session.userId,
      orgId: session.orgId,
      orgGate: await resolveWorkspaceAssistantOrgSetupGate({
        db: input.db,
        clerkOrgId: session.orgId,
      }),
    },
  };
}
