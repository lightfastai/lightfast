import { describe, expect, it } from "vitest";

import { resolveSimulatedEntityFixture } from "../index";
import { entityResolutionResultToPersistenceBatch } from "../persistence";

describe("entity resolution persistence adapter", () => {
  it("converts simulated resolver output into DB-agnostic persistence inputs", () => {
    const batch = entityResolutionResultToPersistenceBatch(
      resolveSimulatedEntityFixture()
    );

    expect(batch.sourceIdentities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identityKey: "x:handle:ava_ai",
          identityType: "handle",
          normalizedValue: "ava_ai",
          provider: "x",
        }),
      ])
    );

    const avaPerson = batch.candidateGroups.find(
      (candidate) =>
        candidate.candidateType === "person" &&
        candidate.outputJson.displayName === "Ava Chen"
    );
    expect(avaPerson?.candidateKey).toBe(
      "person:github:handle:avachen|x:handle:ava_ai"
    );

    const acmeAccount = batch.candidateGroups.find(
      (candidate) =>
        candidate.candidateType === "account" &&
        candidate.outputJson.displayName === "Acme"
    );
    expect(acmeAccount?.candidateKey).toBe("account:domain:acme.com");

    const oldCrmAffiliation = batch.candidateGroups.find(
      (candidate) =>
        candidate.candidateType === "affiliation" &&
        candidate.outputJson.personDisplayName === "Tomas Reed" &&
        candidate.outputJson.accountDisplayName === "OldCRM"
    );
    expect(oldCrmAffiliation).toMatchObject({
      candidateType: "affiliation",
      metadata: {
        relationship: "historical",
      },
      outputJson: {
        accountDisplayName: "OldCRM",
        personDisplayName: "Tomas Reed",
        relationship: "historical",
      },
    });
  });
});
