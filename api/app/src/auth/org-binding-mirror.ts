/**
 * Clerk org setup-gate mirror service.
 *
 * The `lightfast_org_source_control_bindings` DB row is the authoritative
 * source of truth for source-control installation details. The derived setup
 * gate is mirrored into Clerk organization `publicMetadata` so Clerk can mint
 * it into web-session claims for proxy routing UX. API authorization still reads
 * the authoritative DB binding and derives the gate server-side.
 *
 * This service therefore never swallows Clerk failures: callers decide whether
 * stale web-session routing UX should fail or be repaired asynchronously.
 */

import type { OrgSetupGate } from "@repo/api-contract";
import type { LightfastSessionClaims } from "@repo/app-clerk-claim";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";

const BINDING_STATUS_CLAIM =
  "lf_binding_status" satisfies keyof LightfastSessionClaims;
const NEXT_SETUP_REQUIREMENT_CLAIM =
  "lf_next_setup_requirement" satisfies keyof LightfastSessionClaims;

interface LightfastOrgPublicMetadata {
  lightfast?: {
    binding?: {
      status?: "bound" | "unbound";
      provider?: "github";
      updatedAt?: string;
    };
  };
}

type OrgBinding = NonNullable<
  NonNullable<LightfastOrgPublicMetadata["lightfast"]>["binding"]
>;

export interface MirrorOrgSetupGateInput {
  clerkOrgId: string;
  gate: OrgSetupGate;
  provider?: NonNullable<OrgBinding["provider"]>;
}

export async function mirrorOrgSetupGate(
  input: MirrorOrgSetupGateInput
): Promise<void> {
  const { clerkOrgId, gate, provider = "github" } = input;
  const clerk = await clerkClient();
  const org = await clerk.organizations.getOrganization({
    organizationId: clerkOrgId,
  });

  const current = org.publicMetadata as Record<string, unknown>;
  const currentLightfast =
    (current.lightfast as LightfastOrgPublicMetadata["lightfast"]) ?? {};

  const nextBinding = {
    status: gate.bindingStatus,
    provider,
    updatedAt: new Date().toISOString(),
  } satisfies OrgBinding;

  const { nextSetupRequirement: _nextSetupRequirement, ...lightfastRest } =
    currentLightfast as Record<string, unknown>;
  const nextLightfast = {
    ...lightfastRest,
    binding: nextBinding,
    ...(gate.nextSetupRequirement
      ? { nextSetupRequirement: gate.nextSetupRequirement }
      : {}),
  };

  const nextPublicMetadata = {
    ...current,
    lightfast: nextLightfast,
  };

  await clerk.organizations.updateOrganization(clerkOrgId, {
    publicMetadata: nextPublicMetadata,
  });

  log.info("[org-binding-mirror] mirrored setup gate to Clerk", {
    clerkOrgId,
    claim: BINDING_STATUS_CLAIM,
    nextSetupRequirementClaim: NEXT_SETUP_REQUIREMENT_CLAIM,
    status: gate.bindingStatus,
    nextSetupRequirement: gate.nextSetupRequirement,
    provider,
  });
}
