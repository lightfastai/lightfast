import { describe, expect, it } from "vitest";

import {
  KNOWN_X_GITHUB_PAIR_SEEDS,
  resolveKnownXGitHubPairFixture,
  serializeEntityResolutionResult,
} from "../index";

describe("@repo/entity-resolution known-pair fixture", () => {
  it("ships a useful seed corpus with deterministic public cross-links", () => {
    expect(KNOWN_X_GITHUB_PAIR_SEEDS).toHaveLength(20);
    expect(KNOWN_X_GITHUB_PAIR_SEEDS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: "Evan You",
          githubLogin: "yyx990803",
          xUsername: "evanyou",
        }),
        expect.objectContaining({
          displayName: "Jason Miller",
          githubLogin: "developit",
          xUsername: "_developit",
        }),
        expect.objectContaining({
          displayName: "Tanner Linsley",
          githubLogin: "tannerlinsley",
          xUsername: "tannerlinsley",
        }),
      ])
    );
  });

  it("resolves every known pair into one likely linked person", () => {
    const result = resolveKnownXGitHubPairFixture();

    expect(result.people).toHaveLength(KNOWN_X_GITHUB_PAIR_SEEDS.length);
    expect(result.people.every((person) => person.status === "likely")).toBe(
      true
    );
    expect(
      result.people.every((person) =>
        person.evidence.some((item) => item.kind === "person.cross_link")
      )
    ).toBe(true);
  });

  it("preserves non-matching X and GitHub usernames as linked identities", () => {
    const result = resolveKnownXGitHubPairFixture();
    const evan = result.people.find(
      (person) => person.displayName === "Evan You"
    );
    const jason = result.people.find(
      (person) => person.displayName === "Jason Miller"
    );

    expect(evan?.sourceIdentities.map((identity) => identity.key)).toEqual(
      expect.arrayContaining(["x:handle:evanyou", "github:handle:yyx990803"])
    );
    expect(jason?.sourceIdentities.map((identity) => identity.key)).toEqual(
      expect.arrayContaining(["x:handle:_developit", "github:handle:developit"])
    );
  });

  it("serializes a stable JSON artifact for local inspection", () => {
    const result = resolveKnownXGitHubPairFixture();
    const serialized = serializeEntityResolutionResult(result);
    const parsed = JSON.parse(serialized) as typeof result;

    expect(serialized).toMatch(/^\{\n {2}"people": \[/);
    expect(parsed.people[0]).toHaveProperty("displayName");
    expect(parsed.people[0]?.evidence.length).toBeGreaterThan(0);
    expect(parsed.businesses.map((business) => business.displayName)).toEqual(
      [...parsed.businesses]
        .map((business) => business.displayName)
        .sort((left, right) => left.localeCompare(right))
    );
  });
});
