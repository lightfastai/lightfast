/**
 * Org Source-Control Binding repository helpers.
 *
 * The only shared DB interface the app/API layers need for the binding gate.
 * The DB row is the authoritative source of truth; Clerk org metadata is a
 * downstream mirror written by the API layer after these helpers succeed.
 *
 * Every helper takes the `db` client as its first argument so callers can pass
 * `ctx.db` and the helpers stay independently testable.
 */

import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import type {
  OrgSourceControlBinding,
  OrgSourceControlBindingProvider,
} from "../schema";
import { orgSourceControlBindings } from "../schema";

/**
 * Returns the org's single active source-control binding, or `undefined` when
 * the org is not bound.
 */
export async function getActiveOrgBinding(
  db: Database,
  clerkOrgId: string
): Promise<OrgSourceControlBinding | undefined> {
  const [row] = await db
    .select()
    .from(orgSourceControlBindings)
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, clerkOrgId),
        eq(orgSourceControlBindings.status, "active")
      )
    )
    .limit(1);
  return row;
}

/**
 * True when the org has at least one active binding — the v1 "bound" gate.
 */
export async function isOrgBound(
  db: Database,
  clerkOrgId: string
): Promise<boolean> {
  return (await getActiveOrgBinding(db, clerkOrgId)) !== undefined;
}

export interface UpsertActiveOrgBindingInput {
  clerkOrgId: string;
  /** Clerk user id that completed the bind. */
  connectedByUserId: string;
  metadata?: Record<string, unknown>;
  provider: OrgSourceControlBindingProvider;
  providerAccountId?: string | null;
  providerAccountLogin?: string | null;
  providerInstallationId?: string | null;
}

/**
 * Creates the org's active binding, or returns the existing one if the org is
 * already bound. Idempotent — safe to call repeatedly from the `bind` task.
 *
 * v1 does not mutate an existing active binding; re-auth and scope editing are
 * future Binding-management work.
 */
export async function upsertActiveOrgBinding(
  db: Database,
  input: UpsertActiveOrgBindingInput
): Promise<OrgSourceControlBinding> {
  const existing = await getActiveOrgBinding(db, input.clerkOrgId);
  if (existing) {
    return existing;
  }

  const [row] = await db
    .insert(orgSourceControlBindings)
    .values({
      clerkOrgId: input.clerkOrgId,
      provider: input.provider,
      connectedByUserId: input.connectedByUserId,
      providerAccountId: input.providerAccountId ?? null,
      providerAccountLogin: input.providerAccountLogin ?? null,
      providerInstallationId: input.providerInstallationId ?? null,
      metadata: input.metadata ?? {},
      status: "active",
    })
    .returning();

  if (!row) {
    throw new Error(
      `Failed to insert active binding for org ${input.clerkOrgId}`
    );
  }
  return row;
}

export interface MarkOrgBindingRevokedInput {
  clerkOrgId: string;
}

/**
 * Revokes every active binding for the org. Returns the rows transitioned to
 * `revoked` — empty when the org had no active binding.
 */
export async function markOrgBindingRevoked(
  db: Database,
  input: MarkOrgBindingRevokedInput
): Promise<OrgSourceControlBinding[]> {
  const now = new Date().toISOString();
  return await db
    .update(orgSourceControlBindings)
    .set({ status: "revoked", revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(orgSourceControlBindings.clerkOrgId, input.clerkOrgId),
        eq(orgSourceControlBindings.status, "active")
      )
    )
    .returning();
}
