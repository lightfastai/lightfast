/**
 * Clerk org-binding mirror service.
 *
 * The `lightfast_org_source_control_bindings` DB row is the authoritative
 * source of truth for whether an org is bound. This service writes a compact,
 * non-sensitive *mirror* of that state into Clerk organization `publicMetadata`
 * so Clerk can mint it into the `lf_binding_status` session/JWT claim that web,
 * CLI, and desktop clients all read.
 *
 * Caller write ordering (see plan Phase 2.2) — both orders fail closed, so a
 * partial failure leaves the org blocked, never granted, until retry/repair:
 *
 *  - Bind:   write the DB active binding first, then call this with `bound`.
 *            If this fails, the org stays blocked by stale/missing claims; the
 *            DB row remains authoritative for repair.
 *  - Revoke: call this with `revoked` first, then mark the DB row revoked.
 *            If the DB write fails afterwards, the org is blocked until repair —
 *            safer than granting access after revocation.
 *
 * This service therefore never swallows Clerk failures: it throws so the caller
 * can apply the fail-closed ordering above.
 */

import { clerkClient } from "@vendor/clerk/server";
import type { LightfastOrgPublicMetadata } from "@vendor/clerk/types";
import { log } from "@vendor/observability/log/next";

type OrgBinding = NonNullable<
  NonNullable<LightfastOrgPublicMetadata["lightfast"]>["binding"]
>;

/**
 * Statuses the mirror writes. Missing metadata is read as `unbound` by every
 * consumer, so the mirror never needs to write `"unbound"` explicitly.
 */
export type OrgBindingMirrorStatus = Extract<
  OrgBinding["status"],
  "bound" | "revoked"
>;

export interface MirrorOrgBindingInput {
  /** Clerk organization id whose `publicMetadata` mirror is updated. */
  clerkOrgId: string;
  /** Source-control provider. v1 only ships `github`. */
  provider?: NonNullable<OrgBinding["provider"]>;
  /** Mirror status to write — must match the authoritative DB binding state. */
  status: OrgBindingMirrorStatus;
}

/**
 * Mirrors the org's binding state into Clerk organization `publicMetadata`.
 *
 * Only the `lightfast.binding` subtree is touched — unrelated `publicMetadata`
 * keys and other `lightfast.*` keys survive the round-trip untouched. Provider
 * secrets, installation ids, tokens, and repo scopes must never be passed here:
 * they stay in the Lightfast DB.
 */
export async function mirrorOrgBinding(
  input: MirrorOrgBindingInput
): Promise<void> {
  const { clerkOrgId, status, provider = "github" } = input;
  const clerk = await clerkClient();

  const org = await clerk.organizations.getOrganization({
    organizationId: clerkOrgId,
  });

  // `publicMetadata` carries an index signature; spread it as an opaque record
  // so unrelated top-level keys survive the round-trip.
  const current = org.publicMetadata as Record<string, unknown>;
  const currentLightfast =
    (current.lightfast as LightfastOrgPublicMetadata["lightfast"]) ?? {};

  const nextPublicMetadata = {
    ...current,
    lightfast: {
      ...currentLightfast,
      binding: {
        status,
        provider,
        updatedAt: new Date().toISOString(),
      } satisfies OrgBinding,
    },
  };

  await clerk.organizations.updateOrganization(clerkOrgId, {
    publicMetadata: nextPublicMetadata,
  });

  log.info("[org-binding-mirror] mirrored binding status to Clerk", {
    clerkOrgId,
    status,
    provider,
  });
}
