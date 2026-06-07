import { createHash } from "node:crypto";
import type { EntityObservation } from "@repo/entity-resolution";

export function signalProfileObservationIds(input: {
  clerkOrgId: string;
  observations: EntityObservation[];
  signalId: string;
}): { eventId: string; ingestionId: string } {
  const normalizedObservations = input.observations.map((observation) => ({
    profile: observation.profile,
    provider: observation.provider,
  }));
  const normalized = JSON.stringify({
    clerkOrgId: input.clerkOrgId,
    observations: normalizedObservations,
    signalId: input.signalId,
  });
  const hash = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 32);

  return {
    eventId: `signal-entity-enrichment-${input.clerkOrgId}-${input.signalId}-${hash}`,
    ingestionId: `signal:${input.signalId}:${hash}`,
  };
}
