import { describe, expect, it } from "vitest";

import {
  resolveSimulatedEntityFixture,
  SIMULATED_ENTITY_SCENARIOS,
} from "../index";

describe("@repo/entity-resolution simulated fixture", () => {
  it("ships local-only scenarios for tuning resolver behavior", () => {
    expect(SIMULATED_ENTITY_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "clean-cross-link",
      "different-handles",
      "x-only-founder",
      "github-only-maintainer",
      "conflicting-affiliation",
      "pseudonymous-x",
      "stale-github-company",
      "domain-only-business",
    ]);
  });

  it("resolves simulated observations without live provider data", () => {
    const result = resolveSimulatedEntityFixture();

    expect(result.people).toHaveLength(8);
    expect(result.businesses.length).toBeGreaterThanOrEqual(6);
    expect(result.people.map((person) => person.status)).toEqual(
      expect.arrayContaining(["likely", "possible", "conflicting"])
    );
  });

  it("includes conflict and weak-identity cases for local scoring work", () => {
    const result = resolveSimulatedEntityFixture();
    const conflict = result.people.find(
      (person) => person.displayName === "Mira Patel"
    );
    const pseudonymous = result.people.find(
      (person) => person.displayName === "agentloop"
    );

    expect(conflict).toMatchObject({
      status: "conflicting",
      conflicts: [
        expect.objectContaining({
          kind: "business.affiliation",
          values: ["Northstar AI", "Orbit Labs"],
        }),
      ],
    });
    expect(pseudonymous).toMatchObject({
      status: "possible",
      sourceIdentities: [
        expect.objectContaining({ key: "x:handle:agentloop" }),
      ],
    });
  });

  it("treats ex-company GitHub fields as historical rather than conflicting", () => {
    const result = resolveSimulatedEntityFixture();
    const staleCompany = result.people.find(
      (person) => person.displayName === "Tomas Reed"
    );

    expect(staleCompany).toMatchObject({
      status: "likely",
      conflicts: [],
      affiliations: [
        expect.objectContaining({
          businessName: "Freshflow",
          relationship: "current",
        }),
        expect.objectContaining({
          businessName: "OldCRM",
          relationship: "historical",
        }),
      ],
    });
  });
});
