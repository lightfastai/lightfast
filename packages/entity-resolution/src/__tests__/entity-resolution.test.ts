import { describe, expect, it } from "vitest";

import {
  entityResolutionStatusSchema,
  normalizeHandle,
  normalizeProfileUrl,
  resolveEntityCandidates,
  resolveEntityStatus,
  sourceIdentityKey,
} from "../index";

describe("@repo/entity-resolution status vocabulary", () => {
  it("keeps the resolver lifecycle statuses explicit", () => {
    expect(entityResolutionStatusSchema.options).toEqual([
      "confirmed",
      "likely",
      "possible",
      "conflicting",
      "rejected",
    ]);
  });

  it("assigns statuses from confidence and conflict state", () => {
    expect(resolveEntityStatus({ confidence: 0.99, confirmed: true })).toBe(
      "confirmed"
    );
    expect(resolveEntityStatus({ confidence: 0.92 })).toBe("likely");
    expect(resolveEntityStatus({ confidence: 0.42 })).toBe("possible");
    expect(resolveEntityStatus({ confidence: 0 })).toBe("rejected");
    expect(resolveEntityStatus({ confidence: 0.92, conflicting: true })).toBe(
      "conflicting"
    );
  });
});

describe("@repo/entity-resolution source identity normalization", () => {
  it("normalizes durable X and GitHub handles", () => {
    expect(normalizeHandle("x", " @Ava_AI ")).toEqual({
      provider: "x",
      type: "handle",
      value: "ava_ai",
      key: "x:handle:ava_ai",
    });
    expect(normalizeHandle("github", "Lightfast-AI")).toEqual({
      provider: "github",
      type: "handle",
      value: "lightfast-ai",
      key: "github:handle:lightfast-ai",
    });
    expect(normalizeHandle("github", "bad/path")).toBeUndefined();
  });

  it("collapses known social profile URLs to handles", () => {
    expect(
      normalizeProfileUrl("x", "https://twitter.com/Ava_AI?ref=home")
    ).toEqual({
      provider: "x",
      type: "handle",
      value: "ava_ai",
      key: "x:handle:ava_ai",
    });
    expect(
      normalizeProfileUrl("github", "https://github.com/Lightfast-AI/")
    ).toEqual({
      provider: "github",
      type: "handle",
      value: "lightfast-ai",
      key: "github:handle:lightfast-ai",
    });
  });

  it("creates stable source identity keys", () => {
    expect(
      sourceIdentityKey({
        provider: "domain",
        type: "domain",
        value: "Acme.com",
      })
    ).toBe("domain:domain:acme.com");
  });
});

describe("@repo/entity-resolution candidates", () => {
  it("merges X and GitHub profiles when GitHub links the X handle", () => {
    const result = resolveEntityCandidates({
      observations: [
        {
          provider: "x",
          observedAt: "2026-06-06T00:00:00.000Z",
          profile: {
            id: "x_ava",
            username: "ava_ai",
            name: "Ava Chen",
            description: "VP Revenue at Acme. Building AI workflows.",
            location: "San Francisco",
            url: "https://acme.com",
          },
        },
        {
          provider: "github",
          observedAt: "2026-06-06T00:00:00.000Z",
          profile: {
            id: "gh_ava",
            login: "avachen",
            name: "Ava Chen",
            company: "@acme",
            blog: "https://acme.com/team/ava",
            location: "San Francisco",
            bio: "Building AI workflows.",
            twitterUsername: "ava_ai",
          },
        },
      ],
    });

    expect(result.people).toHaveLength(1);
    expect(result.people[0]).toMatchObject({
      displayName: "Ava Chen",
      confidence: 0.92,
      status: "likely",
      affiliations: [
        {
          businessName: "Acme",
          confidence: 0.86,
          status: "likely",
        },
      ],
    });
    expect(result.people[0]?.sourceIdentities.map((item) => item.key)).toEqual(
      expect.arrayContaining(["x:handle:ava_ai", "github:handle:avachen"])
    );
    expect(result.people[0]?.evidence.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "person.cross_link",
        "person.name",
        "business.domain",
        "person.affiliation",
      ])
    );
    expect(result.businesses).toEqual([
      expect.objectContaining({
        displayName: "Acme",
        domains: ["acme.com"],
        confidence: 0.86,
        status: "likely",
      }),
    ]);
  });

  it("keeps a single-source GitHub profile as a possible person", () => {
    const result = resolveEntityCandidates({
      observations: [
        {
          provider: "github",
          profile: {
            id: "gh_solo",
            login: "solo-builder",
            name: "Solo Builder",
            blog: "https://solo.example",
            location: "Melbourne",
          },
        },
      ],
    });

    expect(result.people).toEqual([
      expect.objectContaining({
        displayName: "Solo Builder",
        confidence: 0.48,
        status: "possible",
      }),
    ]);
    expect(result.businesses).toEqual([
      expect.objectContaining({
        displayName: "solo.example",
        domains: ["solo.example"],
        status: "possible",
      }),
    ]);
  });

  it("marks linked profiles as conflicting when strong affiliations disagree", () => {
    const result = resolveEntityCandidates({
      observations: [
        {
          provider: "x",
          profile: {
            id: "x_sam",
            username: "sam_builder",
            name: "Sam Builder",
            description: "Founder at Beta Labs.",
            url: "https://beta.example",
          },
        },
        {
          provider: "github",
          profile: {
            id: "gh_sam",
            login: "sam-dev",
            name: "Sam Builder",
            company: "@acme",
            blog: "https://acme.com",
            twitterUsername: "sam_builder",
          },
        },
      ],
    });

    expect(result.people).toEqual([
      expect.objectContaining({
        displayName: "Sam Builder",
        status: "conflicting",
        conflicts: [
          expect.objectContaining({
            kind: "business.affiliation",
            values: ["Acme", "Beta Labs"],
          }),
        ],
      }),
    ]);
    expect(result.businesses.map((business) => business.displayName)).toEqual([
      "Acme",
      "Beta Labs",
    ]);
  });
});
